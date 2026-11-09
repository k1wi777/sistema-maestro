import { Inject, Injectable } from '@nestjs/common';
import {
  ApiErrorCode,
  ReviewAction,
  type Review,
  type ReviewDecision,
  type ReviewFieldChange,
  type ReviewRecordType,
} from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review.repository';

export interface RecordReviewInput {
  recordType: ReviewRecordType;
  recordId: string;
  reviewerId: string;
  decision: ReviewDecision;
  comment: string | null;
  /** Campos que de verdad cambiaron (resultado de `diffFields`); vacío si no hubo ajustes. */
  changes: readonly ReviewFieldChange[];
}

/**
 * Revisión de coordinación genérica: no conoce planeaciones. Cada tipo de registro aporta su
 * `recordType`, su mapa de campos ajustables y sus rutas (BE-5 planeación, BE-6 diario y
 * observador). Escribe siempre dentro de la transacción de la petición.
 */
@Injectable()
export class ReviewsService {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly repository: ReviewRepository) {}

  /** El revisor nunca es el autor: otra persona de coordinación debe revisar. */
  assertNotSelfReview(ownerId: string, reviewerId: string): void {
    if (ownerId === reviewerId) {
      throw new ApiCodedException(
        403,
        ApiErrorCode.SelfReviewForbidden,
        'No puedes revisar un registro propio: debe hacerlo otra persona de coordinación',
      );
    }
  }

  /**
   * Inserta la fila `ajuste` si hubo cambios y después la de la decisión, con la misma
   * `fecha` (misma operación). La decisión es la que fija el estado del registro.
   */
  async record(input: RecordReviewInput): Promise<void> {
    const date = new Date();
    const base = {
      recordType: input.recordType,
      recordId: input.recordId,
      reviewerId: input.reviewerId,
      date,
    };
    if (input.changes.length > 0) {
      await this.repository.insert({
        ...base,
        action: ReviewAction.Adjustment,
        comment: null,
        adjustedFields: input.changes.map((change) => change.field),
        changes: [...input.changes],
      });
    }
    await this.repository.insert({
      ...base,
      action: input.decision,
      comment: input.comment,
      adjustedFields: [],
      changes: null,
    });
  }

  /** Historial cronológico; con la misma `fecha`, el ajuste va antes de su decisión. */
  async history(recordType: ReviewRecordType, recordId: string): Promise<Review[]> {
    const rows = await this.repository.findByRecord(recordType, recordId);
    const rank = (review: Review) => (review.action === ReviewAction.Adjustment ? 0 : 1);
    return rows
      .map((review, index) => ({ review, index }))
      .sort(
        (a, b) =>
          a.review.date.getTime() - b.review.date.getTime() ||
          rank(a.review) - rank(b.review) ||
          a.index - b.index,
      )
      .map(({ review }) => review);
  }
}

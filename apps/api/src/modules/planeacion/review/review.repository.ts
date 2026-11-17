import type { Review, ReviewAction, ReviewFieldChange, ReviewRecordType } from '@gns/shared';

export interface NewReview {
  recordType: ReviewRecordType;
  recordId: string;
  reviewerId: string;
  action: ReviewAction;
  comment: string | null;
  adjustedFields: string[];
  /** Valores anterior y nuevo; `null` en las filas que no ajustan nada. */
  changes: ReviewFieldChange[] | null;
  date: Date;
}

export interface ReviewRepository {
  /** Inserta la fila y devuelve su id. */
  insert(review: NewReview): Promise<string>;
  /** Historial del registro con su revisor, sin ordenar el ajuste respecto a su decisión. */
  findByRecord(recordType: ReviewRecordType, recordId: string): Promise<Review[]>;
}

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

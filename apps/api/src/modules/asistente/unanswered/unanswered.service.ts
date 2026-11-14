import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApiErrorCode,
  UNANSWERED_QUESTION_TEXT_MAX_LENGTH,
  UnansweredQuestionStatus,
  foldSearchText,
  type ListQuery,
  type Page,
  type UnansweredFilters,
  type UnansweredQuestion,
  type UnansweredSortField,
} from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { UNANSWERED_REPOSITORY, type UnansweredRepository } from './unanswered.repository';

export const UNANSWERED_CLOSED_MESSAGE = 'La pregunta sin respuesta ya fue atendida o descartada';

/** Texto que se muestra: recortado y con los espacios colapsados, como lo escribió la persona. */
export function displayText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, UNANSWERED_QUESTION_TEXT_MAX_LENGTH);
}

/** Clave de agrupación: sin tildes, mayúsculas ni signos, con los espacios colapsados. */
export function normalizeQuestionText(text: string): string {
  return foldSearchText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, UNANSWERED_QUESTION_TEXT_MAX_LENGTH);
}

@Injectable()
export class UnansweredService {
  constructor(
    @Inject(UNANSWERED_REPOSITORY) private readonly repository: UnansweredRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
  ) {}

  list(
    query: ListQuery<UnansweredFilters, UnansweredSortField>,
  ): Promise<Page<UnansweredQuestion>> {
    return this.repository.findPage(query);
  }

  async get(id: string): Promise<UnansweredQuestion> {
    return this.require(await this.repository.findById(id));
  }

  /** Estado del grupo (sin ocurrencias) para la bitácora; `null` si no existe. */
  async forAudit(id: string): Promise<Record<string, unknown> | null> {
    const group = await this.repository.findGroup(id);
    return group ? { ...group } : null;
  }

  /** Registra una pregunta que quedó sin respuesta y devuelve el id de su grupo (R13). */
  register(userId: string, text: string): Promise<string> {
    const shown = displayText(text);
    return this.repository.recordOccurrence({
      text: shown,
      normalizedText: normalizeQuestionText(shown),
      userId,
      at: new Date(),
    });
  }

  /** Cierra como atendida al crear la pregunta frecuente `faqId` (R15). */
  attend(userId: string, id: string, faqId: string): Promise<void> {
    return this.close(id, {
      status: UnansweredQuestionStatus.Attended,
      closedById: userId,
      faqId,
    });
  }

  /** Cierra como descartada y devuelve su estado final (R16). */
  async discard(userId: string, id: string): Promise<UnansweredQuestion> {
    await this.close(id, {
      status: UnansweredQuestionStatus.Discarded,
      closedById: userId,
      faqId: null,
    });
    return this.get(id);
  }

  private async close(
    id: string,
    input: { status: 'atendida' | 'descartada'; closedById: string; faqId: string | null },
  ): Promise<void> {
    await this.transactions.run(async () => {
      const closed = await this.repository.close(id, { ...input, closedAt: new Date() });
      if (closed) {
        return;
      }
      // Cero filas: o no existe (404) o ya no está pendiente (409).
      this.require(await this.repository.findGroup(id));
      throw new ApiCodedException(
        409,
        ApiErrorCode.UnansweredQuestionClosed,
        UNANSWERED_CLOSED_MESSAGE,
      );
    });
  }

  private require(question: UnansweredQuestion | null): UnansweredQuestion {
    if (!question) {
      throw new NotFoundException('La pregunta sin respuesta no existe');
    }
    return question;
  }
}

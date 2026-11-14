import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateFaqInput,
  FaqAdminView,
  FaqFilters,
  FaqList,
  FaqSortField,
  ListQuery,
  Page,
  UpdateFaqInput,
} from '@gns/shared';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { UnansweredService } from '../unanswered/unanswered.service';
import { FAQS_REPOSITORY, type FaqsRepository } from './faqs.repository';

@Injectable()
export class FaqsService {
  constructor(
    @Inject(FAQS_REPOSITORY) private readonly repository: FaqsRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly unanswered: UnansweredService,
  ) {}

  /** Las activas para cualquier rol (R1). */
  async listActive(): Promise<FaqList> {
    return { items: await this.repository.findActive() };
  }

  list(query: ListQuery<FaqFilters, FaqSortField>): Promise<Page<FaqAdminView>> {
    return this.repository.findPage(query);
  }

  async get(id: string): Promise<FaqAdminView> {
    const faq = await this.repository.findById(id);
    if (!faq) {
      throw new NotFoundException('La pregunta frecuente no existe');
    }
    return faq;
  }

  /** Estado para la bitácora; `null` si no existe. */
  async forAudit(id: string): Promise<Record<string, unknown> | null> {
    const faq = await this.repository.findById(id);
    return faq ? { ...faq } : null;
  }

  /**
   * Crea la pregunta (R2). Con `unansweredQuestionId` cierra esa pregunta sin respuesta en la misma
   * transacción: si no existe (404) o no está pendiente (409), no se crea nada (R15).
   */
  create(userId: string, input: CreateFaqInput): Promise<FaqAdminView> {
    const { unansweredQuestionId, ...data } = input;
    return this.transactions.run(async () => {
      const faq = await this.repository.create(data, userId);
      if (unansweredQuestionId) {
        await this.unanswered.attend(userId, unansweredQuestionId, faq.id);
      }
      return faq;
    });
  }

  async update(userId: string, id: string, input: UpdateFaqInput): Promise<FaqAdminView> {
    await this.get(id);
    return this.repository.update(id, input, userId);
  }
}

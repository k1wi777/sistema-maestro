import type {
  CreateFaqInput,
  FaqAdminView,
  FaqFilters,
  FaqSortField,
  FaqView,
  UpdateFaqInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

export interface FaqsRepository extends ReadRepository<FaqAdminView, FaqFilters, FaqSortField> {
  /** Solo las activas, por categoría y pregunta, sin palabras clave ni autoría (R1). */
  findActive(): Promise<FaqView[]>;
  /** Crea la pregunta y deja a `userId` como quien la actualizó por última vez (R2). */
  create(
    input: Omit<CreateFaqInput, 'unansweredQuestionId'>,
    userId: string,
  ): Promise<FaqAdminView>;
  /** Actualiza solo los campos enviados (R3). La pregunta debe existir. */
  update(id: string, input: UpdateFaqInput, userId: string): Promise<FaqAdminView>;
}

export const FAQS_REPOSITORY = Symbol('FAQS_REPOSITORY');

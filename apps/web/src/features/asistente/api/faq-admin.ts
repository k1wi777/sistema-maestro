import {
  createPageSchema,
  faqAdminViewSchema,
  unansweredQuestionSchema,
  type CreateFaqInput,
  type FaqAdminView,
  type UnansweredQuestion,
  type UpdateFaqInput,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

const faqPageSchema = createPageSchema(faqAdminViewSchema);
const unansweredPageSchema = createPageSchema(unansweredQuestionSchema);
const ALL = '100';

/** Todas las preguntas programadas (activas e inactivas), página a página. */
export async function listAllFaqs(): Promise<ApiResult<FaqAdminView[]>> {
  const faqs: FaqAdminView[] = [];
  for (let page = 1; ; page += 1) {
    const result = parseResult(
      await callApi(() =>
        api.GET('/faqs', { params: { query: { page: String(page), pageSize: ALL } } }),
      ),
      faqPageSchema,
    );
    if (!result.ok) {
      return result;
    }
    faqs.push(...result.data.items);
    if (page >= result.data.totalPages) {
      return { ok: true, data: faqs };
    }
  }
}

/** Crea una pregunta programada; con `unansweredQuestionId` atiende esa pregunta sin respuesta. */
export async function createFaq(input: CreateFaqInput): Promise<ApiResult<FaqAdminView>> {
  const result = await callApi(() => api.POST('/faqs', { body: input }));
  return parseResult(result, faqAdminViewSchema);
}

/** Edita una pregunta o la activa o desactiva (`isActive`): no existe borrado. */
export async function updateFaq(
  id: string,
  input: UpdateFaqInput,
): Promise<ApiResult<FaqAdminView>> {
  const result = await callApi(() =>
    api.PATCH('/faqs/{id}', { params: { path: { id } }, body: input }),
  );
  return parseResult(result, faqAdminViewSchema);
}

/** Preguntas sin respuesta pendientes (la API las trae por número de veces), todas las páginas. */
export async function listPendingQuestions(): Promise<ApiResult<UnansweredQuestion[]>> {
  const questions: UnansweredQuestion[] = [];
  for (let page = 1; ; page += 1) {
    const result = parseResult(
      await callApi(() =>
        api.GET('/unanswered-questions', {
          params: { query: { page: String(page), pageSize: ALL, status: 'pendiente' } },
        }),
      ),
      unansweredPageSchema,
    );
    if (!result.ok) {
      return result;
    }
    questions.push(...result.data.items);
    if (page >= result.data.totalPages) {
      return { ok: true, data: questions };
    }
  }
}

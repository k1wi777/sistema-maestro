import {
  assistantAnswerSchema,
  faqListSchema,
  type AssistantAnswer,
  type FaqView,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Todas las preguntas frecuentes activas (sin paginar, sin palabras clave ni autoría). */
export async function listFaqs(): Promise<ApiResult<FaqView[]>> {
  const result = parseResult(await callApi(() => api.GET('/assistant/faqs')), faqListSchema);
  return result.ok ? { ok: true, data: result.data.items } : result;
}

/**
 * Consulta al asistente. La API ya registra la pregunta sin respuesta y la fila de la bitácora
 * (sin el texto escrito): el frontend no guarda nada aparte.
 */
export async function askAssistant(question: string): Promise<ApiResult<AssistantAnswer>> {
  const result = await callApi(() => api.POST('/assistant/queries', { body: { question } }));
  return parseResult(result, assistantAnswerSchema);
}

import { z } from 'zod';

/** Código estable de error de la API (`ApiErrorBody.code`): identificador en inglés, valor en español. */
export const ApiErrorCode = {
  Validation: 'validacion',
  Unauthenticated: 'no_autenticado',
  Forbidden: 'sin_permiso',
  SelfReviewForbidden: 'autorrevision_no_permitida',
  ConsentRequired: 'consentimiento_requerido',
  NotFound: 'no_encontrado',
  Conflict: 'conflicto',
  UnansweredQuestionClosed: 'pregunta_sin_respuesta_cerrada',
  TooManyRequests: 'demasiadas_peticiones',
  StorageUnavailable: 'almacenamiento_no_disponible',
  Internal: 'error_interno',
  Http: 'error_http',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const apiFieldErrorSchema = z.object({
  /** Ruta con puntos del campo (`items.0.nombre`) o nombre del parámetro. */
  field: z.string(),
  reason: z.string(),
});
export type ApiFieldError = z.infer<typeof apiFieldErrorSchema>;

/** Cuerpo común de todas las respuestas de error de la API. */
export const apiErrorBodySchema = z.object({
  statusCode: z.number().int(),
  code: z.enum(Object.values(ApiErrorCode) as [ApiErrorCode, ...ApiErrorCode[]]),
  message: z.string(),
  errors: z.array(apiFieldErrorSchema).optional(),
  requestId: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

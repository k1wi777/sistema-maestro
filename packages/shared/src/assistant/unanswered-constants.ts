/** Longitud máxima del texto de una consulta al asistente (y de su fila sin respuesta). */
export const UNANSWERED_QUESTION_TEXT_MAX_LENGTH = 200;

/** Mínimo de caracteres de una consulta, tras recortar los espacios. */
export const ASSISTANT_QUESTION_MIN_LENGTH = 2;

/** `pregunta_sin_respuesta.estado`. */
export const UnansweredQuestionStatus = {
  Pending: 'pendiente',
  Attended: 'atendida',
  Discarded: 'descartada',
} as const;
export type UnansweredQuestionStatus =
  (typeof UnansweredQuestionStatus)[keyof typeof UnansweredQuestionStatus];

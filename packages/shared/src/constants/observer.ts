/** Tipo de anotación del observador (`observador_anotacion.tipo`). */
export const ObserverNoteType = {
  Positive: 'positiva',
  Academic: 'academica',
  TypeI: 'tipo_i',
  TypeII: 'tipo_ii',
  TypeIII: 'tipo_iii',
  Other: 'otra',
} as const;
export type ObserverNoteType = (typeof ObserverNoteType)[keyof typeof ObserverNoteType];

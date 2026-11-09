/** Tipo de evento del diario de campo (`diario_entrada.tipo_evento`). */
export const JournalEventType = {
  Group: 'grupo',
  Positive: 'positivo',
  ToImprove: 'mejorar',
} as const;
export type JournalEventType = (typeof JournalEventType)[keyof typeof JournalEventType];

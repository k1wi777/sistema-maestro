/** Tipo de área (`area.tipo`). */
export const AreaType = {
  Subject: 'asignatura',
  Dimension: 'dimension',
} as const;
export type AreaType = (typeof AreaType)[keyof typeof AreaType];

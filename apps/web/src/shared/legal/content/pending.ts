/**
 * Datos legales que el colegio aún no ha confirmado. Cada uno se pinta en las páginas como
 * «Pendiente» con su descripción (nunca se completa con un valor supuesto) y figura en
 * `docs/legal/pendientes.md`; una prueba comprueba que ambos listados coinciden.
 */
export const LEGAL_PENDING = {
  'claims-area': 'área responsable de atender las consultas y los reclamos, por confirmar',
  'effective-date': 'fecha de vigencia del documento, por confirmar',
  processors:
    'encargados del tratamiento (alojamiento y almacenamiento de archivos), según el despliegue que aún no está definido',
  rnbd: 'registro de la base de datos ante la Superintendencia de Industria y Comercio (RNBD), por confirmar si aplica',
  'legal-review': 'revisión jurídica del colegio de los textos antes de publicarlos',
} as const;

export type PendingId = keyof typeof LEGAL_PENDING;

/** Valor de un texto legal sin confirmar: el renderizador lo marca como «Pendiente». */
export interface PendingValue {
  readonly kind: 'pending';
  readonly id: PendingId;
}

export function pending(id: PendingId): PendingValue {
  return { kind: 'pending', id };
}

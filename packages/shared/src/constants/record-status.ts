/**
 * Estado común de los registros pedagógicos (`planeacion.estado` y
 * `observador_anotacion.estado`). Siguen el mismo flujo de revisión y se anulan en
 * lugar de borrarse. El diario de campo tiene estados propios (`JournalStatus`).
 */
export const RecordStatus = {
  Draft: 'borrador',
  Submitted: 'enviada',
  ChangesRequested: 'observaciones',
  Reviewed: 'revisada',
  Voided: 'anulado',
} as const;
export type RecordStatus = (typeof RecordStatus)[keyof typeof RecordStatus];

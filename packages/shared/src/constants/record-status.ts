/**
 * Estado común de los registros pedagógicos (`planeacion.estado`,
 * `diario_campo.estado` y `observador_anotacion.estado`). Todos siguen el mismo
 * flujo de revisión y se anulan en lugar de borrarse.
 */
export const RecordStatus = {
  Draft: 'borrador',
  Submitted: 'enviada',
  ChangesRequested: 'observaciones',
  Reviewed: 'revisada',
  Voided: 'anulado',
} as const;
export type RecordStatus = (typeof RecordStatus)[keyof typeof RecordStatus];

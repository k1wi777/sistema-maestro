/**
 * Lee el estado actual de una entidad para la bitácora. La implementa una clase
 * `@Injectable()` del módulo de dominio delegando en el método de lectura que ya
 * tiene su servicio, para no duplicar la lógica de acceso. Devuelve campos de la
 * propia entidad (sin relaciones) y `null` si no existe.
 */
export interface AuditSnapshotSource {
  load(id: string): Promise<Record<string, unknown> | null>;
  /**
   * Detalle de la fila de bitácora calculado desde el estado posterior, para cuando la acción
   * no tiene detalle estático ni del cuerpo. Solo debe devolver datos sin textos libres.
   */
  describe?(snapshot: Record<string, unknown>): string | null;
}

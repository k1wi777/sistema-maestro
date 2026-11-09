import { SetMetadata, type Type } from '@nestjs/common';
import type { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from './audit-snapshot';

export const AUDITED_KEY = 'gns:audited';

export interface AuditedOptions {
  /** Valor del CHECK `bitacora.tipo`. */
  type: AuditLogType;
  /** Descripción de la acción para la persona que audita. */
  action: string;
  /** Tabla en español de la entidad (`pregunta_frecuente`). */
  entity: string;
  /** Fuente que lee la entidad antes y después de la acción. */
  snapshot: Type<AuditSnapshotSource>;
  detail?: string;
  /**
   * Clave del cuerpo de la petición cuyo texto se guarda como `detalle` (p. ej. el motivo de
   * una anulación). Prevalece sobre `detail`; si el cuerpo no la trae como texto, se usa `detail`.
   */
  detailFromBody?: string;
}

/**
 * Marca un endpoint como auditable: al terminar con éxito, el interceptor global
 * escribe una fila en la bitácora dentro de la misma transacción que la operación.
 * Los endpoints sin este decorador no se auditan (p. ej. las lecturas).
 */
export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_KEY, options);

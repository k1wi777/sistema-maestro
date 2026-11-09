import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { SharedActivitiesService } from './shared-activities.service';

/**
 * Estado de la actividad para la bitácora: los campos de su fila. En el retiro la fila guarda
 * todo el contenido en `datos_antes` y `datos_despues` nulo.
 */
@Injectable()
export class SharedActivityAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly activities: SharedActivitiesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.activities.findRaw(id);
  }
}

/**
 * Favoritos de la ruta (`params.id`): el diff de primer nivel muestra el cambio del conteo y la
 * fila identifica al usuario. Se guarda el conteo y no la lista para no volcar a la bitácora
 * quién más guardó la actividad; en una repetición sin cambio el diff queda vacío.
 */
@Injectable()
export class SharedActivityFavoritesAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly activities: SharedActivitiesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const favoriteCount = await this.activities.favoriteCountForAudit(id);
    return favoriteCount === null ? null : { favoriteCount };
  }
}

/** Opciones de `@Audited` comunes al repositorio de actividades. */
export const SHARED_ACTIVITY_AUDIT = {
  type: AuditLogType.SharedActivity,
  entity: 'actividad_repositorio',
  snapshot: SharedActivityAuditSnapshot,
};

export const SHARED_ACTIVITY_FAVORITES_AUDIT = {
  type: AuditLogType.SharedActivity,
  entity: 'actividad_repositorio',
  snapshot: SharedActivityFavoritesAuditSnapshot,
};

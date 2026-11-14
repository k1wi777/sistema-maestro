import { Injectable } from '@nestjs/common';
import type { AuditLogFilters, AuditLogType } from '@gns/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { startOfBogotaDay, startOfNextBogotaDay } from '../../shared/time/bogota-time';
import type {
  AuditLogPageResult,
  AuditLogReadRepository,
  AuditLogRow,
  AuditLogRowDetail,
} from './audit-log-read.repository';

interface Row {
  id: string;
  occurred_at: Date;
  user_id: string | null;
  user_name: string | null;
  role: string;
  type: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: string | null;
}

interface DetailRow extends Row {
  data_before: unknown;
  data_after: unknown;
}

// El único join es el nombre del usuario: ni correo ni estado ni rol actual. `id` sale como texto
// para no manejar `bigint` en el JSON.
const SELECT_ROW = Prisma.sql`
  b.id::text AS id,
  b.fecha_hora AS occurred_at,
  b.usuario_id::text AS user_id,
  u.nombre_completo AS user_name,
  b.rol AS role,
  b.tipo AS type,
  b.accion AS action,
  b.entidad AS entity,
  b.entidad_id::text AS entity_id,
  b.detalle AS detail
`;
const FROM_ROW = Prisma.sql`FROM bitacora b LEFT JOIN usuario u ON u.id = b.usuario_id`;

const toRow = (row: Row): AuditLogRow => ({
  id: row.id,
  occurredAt: row.occurred_at,
  user: row.user_id === null ? null : { id: row.user_id, name: row.user_name ?? '' },
  role: row.role,
  type: row.type as AuditLogType,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id,
  detail: row.detail,
});

// Fragmentos por filtro presente; todo valor viaja como parámetro de `Prisma.sql`, nunca concatenado.
// Los días son días completos en la hora de Colombia: [inicio de `from`, inicio del día tras `to`).
function conditions(filters: AuditLogFilters): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  if (filters.userId !== undefined) {
    parts.push(Prisma.sql`b.usuario_id = ${filters.userId}::uuid`);
  }
  if (filters.role !== undefined) {
    parts.push(Prisma.sql`b.rol = ${filters.role}`);
  }
  if (filters.type !== undefined) {
    parts.push(Prisma.sql`b.tipo = ${filters.type}`);
  }
  if (filters.from !== undefined) {
    parts.push(Prisma.sql`b.fecha_hora >= ${startOfBogotaDay(filters.from)}::timestamptz`);
  }
  if (filters.to !== undefined) {
    parts.push(Prisma.sql`b.fecha_hora < ${startOfNextBogotaDay(filters.to)}::timestamptz`);
  }
  return parts;
}

const where = (parts: Prisma.Sql[]) =>
  parts.length === 0 ? Prisma.empty : Prisma.sql`WHERE ${Prisma.join(parts, ' AND ')}`;

@Injectable()
export class PrismaAuditLogReadRepository implements AuditLogReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    filters: AuditLogFilters,
    cursor: string | null,
    limit: number,
  ): Promise<AuditLogPageResult> {
    const parts = conditions(filters);
    if (cursor !== null) {
      // La comparación se resuelve en SQL contra la fila del cursor: `fecha_hora` tiene
      // microsegundos y un `Date` de JS solo milisegundos. Un cursor inexistente deja la
      // subconsulta en NULL y la página vacía.
      parts.push(Prisma.sql`(b.fecha_hora, b.id) < (
        SELECT c.fecha_hora, c.id FROM bitacora c WHERE c.id = ${cursor}::bigint
      )`);
    }
    const rows = await this.prisma.db.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_ROW} ${FROM_ROW} ${where(parts)}
      ORDER BY b.fecha_hora DESC, b.id DESC
      LIMIT ${limit + 1}
    `);
    const items = rows.slice(0, limit).map(toRow);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? last.id : null };
  }

  async findById(id: string): Promise<AuditLogRowDetail | null> {
    const rows = await this.prisma.db.$queryRaw<DetailRow[]>(Prisma.sql`
      SELECT ${SELECT_ROW}, b.datos_antes AS data_before, b.datos_despues AS data_after
      ${FROM_ROW}
      WHERE b.id = ${id}::bigint
    `);
    const row = rows[0];
    return row ? { ...toRow(row), dataBefore: row.data_before, dataAfter: row.data_after } : null;
  }

  async findForExport(filters: AuditLogFilters, max: number): Promise<AuditLogRow[]> {
    const rows = await this.prisma.db.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_ROW} ${FROM_ROW} ${where(conditions(filters))}
      ORDER BY b.fecha_hora DESC, b.id DESC
      LIMIT ${max}
    `);
    return rows.map(toRow);
  }
}

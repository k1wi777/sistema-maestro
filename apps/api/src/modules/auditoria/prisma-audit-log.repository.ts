import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import type { AuditLogRepository, NewAuditLogEntry } from './audit-log.repository';

const toJson = (value: unknown) =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(entry: NewAuditLogEntry): Promise<void> {
    // `db`: dentro de la transacción de la petición, para que la fila y la operación
    // de negocio se confirmen o se revoquen juntas.
    await this.prisma.db.auditLog.create({
      data: {
        userId: entry.userId,
        role: entry.role,
        type: entry.type,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        detail: entry.detail,
        dataBefore: toJson(entry.dataBefore),
        dataAfter: toJson(entry.dataAfter),
      },
    });
  }
}

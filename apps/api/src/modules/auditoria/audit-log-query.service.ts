import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApiErrorCode,
  AuditLogType,
  type AuditLogExportQuery,
  type AuditLogFilters,
  type AuditLogListQuery,
} from '@gns/shared';
import type { RequestUser } from '../../core/audit/request-user';
import { ApiCodedException } from '../../core/http/api-coded.exception';
import { AuditLogService } from './audit-log.service';
import { exportCsv, exportFileName } from './audit-log-export';
import {
  AUDIT_LOG_READ_REPOSITORY,
  type AuditLogPageResult,
  type AuditLogReadRepository,
  type AuditLogRowDetail,
} from './audit-log-read.repository';

/** Límite de filas de una exportación; un token para que las pruebas lo bajen sin insertar 10 001 filas. */
export const AUDIT_LOG_EXPORT_LIMIT = Symbol('AUDIT_LOG_EXPORT_LIMIT');

/** Filtros presentes en la query, tal como se guardan en la fila de la exportación. */
const usedFilters = ({ userId, role, type, from, to }: AuditLogFilters): AuditLogFilters =>
  Object.fromEntries(
    Object.entries({ userId, role, type, from, to }).filter(([, value]) => value !== undefined),
  );

/**
 * Consulta de la bitácora (coordinación). El listado y el detalle son lecturas y no escriben en
 * la bitácora; la exportación saca datos de la plataforma y deja constancia.
 */
@Injectable()
export class AuditLogQueryService {
  constructor(
    @Inject(AUDIT_LOG_READ_REPOSITORY) private readonly repository: AuditLogReadRepository,
    private readonly audit: AuditLogService,
    @Inject(AUDIT_LOG_EXPORT_LIMIT) private readonly exportLimit: number,
  ) {}

  list({ limit, cursor, ...filters }: AuditLogListQuery): Promise<AuditLogPageResult> {
    return this.repository.findPage(filters, cursor ?? null, limit);
  }

  async findById(id: string): Promise<AuditLogRowDetail> {
    const entry = await this.repository.findById(id);
    if (!entry) {
      throw new NotFoundException('El registro de la bitácora no existe');
    }
    return entry;
  }

  /**
   * CSV con las filas que cumplen los filtros. Por encima del límite se rechaza (un CSV de
   * auditoría truncado en silencio daría una imagen falsa). La fila de bitácora se escribe antes
   * de armar el archivo: si falla, no sale CSV. Lleva los filtros y el número de filas, nunca
   * su contenido.
   */
  async export(
    user: RequestUser,
    query: AuditLogExportQuery,
    now: Date = new Date(),
  ): Promise<{ fileName: string; content: string }> {
    const rows = await this.repository.findForExport(query, this.exportLimit + 1);
    if (rows.length > this.exportLimit) {
      throw new ApiCodedException(
        422,
        ApiErrorCode.ExportExceedsLimit,
        `La exportación supera ${this.exportLimit} registros: acota las fechas, el usuario o el tipo`,
      );
    }
    await this.audit.record({
      userId: user.id,
      role: user.role,
      type: AuditLogType.Coordination,
      action: 'Exportó la bitácora',
      entity: 'bitacora',
      entityId: null,
      dataAfter: { filters: usedFilters(query), rows: rows.length },
    });
    return { fileName: exportFileName(now), content: exportCsv(rows) };
  }
}

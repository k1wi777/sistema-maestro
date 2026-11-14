import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../core/audit/request-user';
import { RequireRole } from '../identidad/auth/access.decorators';
import { CurrentUser } from '../identidad/auth/current-user.decorator';
import {
  AuditLogEntryDetailDto,
  AuditLogExportQueryDto,
  AuditLogIdParamDto,
  AuditLogListQueryDto,
  AuditLogPageDto,
} from './audit-log.dto';
import { AuditLogQueryService } from './audit-log-query.service';

/**
 * Consulta de la bitácora: coordinación (administración hereda por jerarquía de `RequireRole`) y solo lecturas. No hay
 * ruta que cree, modifique o borre filas. El listado y el detalle no escriben en la bitácora;
 * la exportación sí (la escribe el servicio, con los filtros y el número de filas).
 */
@Controller('audit-log')
@RequireRole(UserRole.Coordinator)
export class AuditLogController {
  constructor(private readonly query: AuditLogQueryService) {}

  @Get()
  @ZodResponse({ status: 200, type: AuditLogPageDto })
  list(@Query() query: AuditLogListQueryDto) {
    return this.query.list(query);
  }

  /** Antes de `:id`; además `:id` solo acepta dígitos, así que `export` no se confunde con un id. */
  @Get('export')
  @ApiOkResponse({
    description: 'CSV de la bitácora: UTF-8 con BOM y separador `;`, hasta 10 000 filas.',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  async export(@CurrentUser() user: RequestUser, @Query() query: AuditLogExportQueryDto) {
    const { fileName, content } = await this.query.export(user, query);
    return new StreamableFile(Buffer.from(content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: AuditLogEntryDetailDto })
  get(@Param() { id }: AuditLogIdParamDto) {
    return this.query.findById(id);
  }
}

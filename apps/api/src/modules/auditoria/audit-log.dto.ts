import {
  auditLogEntryDetailSchema,
  auditLogExportQuerySchema,
  auditLogIdParamSchema,
  auditLogListQuerySchema,
  auditLogPageSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class AuditLogListQueryDto extends createZodDto(auditLogListQuerySchema) {}
export class AuditLogExportQueryDto extends createZodDto(auditLogExportQuerySchema) {}
export class AuditLogIdParamDto extends createZodDto(auditLogIdParamSchema) {}
export class AuditLogPageDto extends createZodDto(auditLogPageSchema, { codec: true }) {}
export class AuditLogEntryDetailDto extends createZodDto(auditLogEntryDetailSchema, {
  codec: true,
}) {}

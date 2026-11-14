import { Module } from '@nestjs/common';
import { AUDIT_LOG_EXPORT_MAX_ROWS } from '@gns/shared';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuditLogController } from './audit-log.controller';
import { AUDIT_LOG_READ_REPOSITORY } from './audit-log-read.repository';
import { AUDIT_LOG_REPOSITORY } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_EXPORT_LIMIT, AuditLogQueryService } from './audit-log-query.service';
import { PrismaAuditLogReadRepository } from './prisma-audit-log-read.repository';
import { PrismaAuditLogRepository } from './prisma-audit-log.repository';

// Sin importar `IdentityModule`: `RequireRole` y `CurrentUser` son metadatos y decoradores, los guards
// son globales, e `IdentityModule` ya importa este módulo (habría un ciclo).
@Module({
  imports: [DatabaseModule],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    AuditLogQueryService,
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    { provide: AUDIT_LOG_READ_REPOSITORY, useClass: PrismaAuditLogReadRepository },
    { provide: AUDIT_LOG_EXPORT_LIMIT, useValue: AUDIT_LOG_EXPORT_MAX_ROWS },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}

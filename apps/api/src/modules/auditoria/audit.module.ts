import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { AUDIT_LOG_REPOSITORY } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import { PrismaAuditLogRepository } from './prisma-audit-log.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    AuditLogService,
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}

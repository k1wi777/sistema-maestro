import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/shared/database/database.module';
import { FaqExampleAuditSnapshot } from './faq-example.audit-snapshot';
import { FaqExampleController } from './faq-example.controller';
import { FAQ_EXAMPLE_REPOSITORY } from './faq-example.repository';
import { FaqExampleService } from './faq-example.service';
import { PrismaFaqExampleRepository } from './prisma-faq-example.repository';

// Solo para pruebas: no se registra en AppModule (publicaría un endpoint de dominio
// sin roles).
@Module({
  imports: [DatabaseModule],
  controllers: [FaqExampleController],
  providers: [
    FaqExampleService,
    FaqExampleAuditSnapshot,
    { provide: FAQ_EXAMPLE_REPOSITORY, useClass: PrismaFaqExampleRepository },
  ],
})
export class FaqExampleModule {}

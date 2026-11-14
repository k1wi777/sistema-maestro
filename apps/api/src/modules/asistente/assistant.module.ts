import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuditModule } from '../auditoria/audit.module';
import { IdentityModule } from '../identidad/identity.module';
import { FaqAuditSnapshot } from './faqs/faq.audit-snapshot';
import { AssistantFaqsController, FaqsController } from './faqs/faqs.controller';
import { FAQS_REPOSITORY } from './faqs/faqs.repository';
import { FaqsService } from './faqs/faqs.service';
import { PrismaFaqsRepository } from './faqs/prisma-faqs.repository';
import { AssistantQueryLog } from './search/assistant-query-log';
import { AssistantQueryService } from './search/assistant-query.service';
import { ASSISTANT_SEARCH_REPOSITORY } from './search/assistant-search.repository';
import { AssistantSearchService } from './search/assistant-search.service';
import { AssistantController } from './search/assistant.controller';
import { PrismaAssistantSearchRepository } from './search/prisma-assistant-search.repository';
import { PrismaUnansweredRepository } from './unanswered/prisma-unanswered.repository';
import { UnansweredQuestionAuditSnapshot } from './unanswered/unanswered.audit-snapshot';
import { UnansweredController } from './unanswered/unanswered.controller';
import { UNANSWERED_REPOSITORY } from './unanswered/unanswered.repository';
import { UnansweredService } from './unanswered/unanswered.service';

/**
 * Asistente: preguntas frecuentes (gestión y lectura), búsqueda en español con la búsqueda de texto
 * de PostgreSQL y preguntas sin respuesta. Sin IA ni servicios externos.
 */
@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [AssistantFaqsController, AssistantController, FaqsController, UnansweredController],
  providers: [
    FaqsService,
    FaqAuditSnapshot,
    { provide: FAQS_REPOSITORY, useClass: PrismaFaqsRepository },
    AssistantSearchService,
    AssistantQueryService,
    AssistantQueryLog,
    { provide: ASSISTANT_SEARCH_REPOSITORY, useClass: PrismaAssistantSearchRepository },
    UnansweredService,
    UnansweredQuestionAuditSnapshot,
    { provide: UNANSWERED_REPOSITORY, useClass: PrismaUnansweredRepository },
  ],
})
export class AssistantModule {}

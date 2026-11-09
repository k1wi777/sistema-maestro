import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { StructureModule } from '../estructura/structure.module';
import { PlanningModule } from '../planeacion/planning.module';
import { FieldJournalAuditSnapshot } from './field-journals/field-journal.audit-snapshot';
import { FieldJournalEntriesController } from './field-journals/field-journal-entries.controller';
import { FIELD_JOURNAL_REPOSITORY } from './field-journals/field-journal.repository';
import { FieldJournalReviewController } from './field-journals/field-journal-review.controller';
import { FieldJournalsController } from './field-journals/field-journals.controller';
import { FieldJournalsService } from './field-journals/field-journals.service';
import { PrismaFieldJournalRepository } from './field-journals/prisma-field-journal.repository';
import { ObserverNoteAuditSnapshot } from './observer-notes/observer-note.audit-snapshot';
import { OBSERVER_NOTE_REPOSITORY } from './observer-notes/observer-note.repository';
import { ObserverNoteReviewController } from './observer-notes/observer-note-review.controller';
import { ObserverNotesController } from './observer-notes/observer-notes.controller';
import { ObserverNotesService } from './observer-notes/observer-notes.service';
import { PrismaObserverNoteRepository } from './observer-notes/prisma-observer-note.repository';

/**
 * Formatos: diario de campo (F-PA-05) y observador del estudiante, con su revisión de
 * coordinación. Reutiliza `ReviewsService` (exportado por Planeación) y la máquina de estados
 * de `@gns/shared`; consulta asignaciones, periodos y grados por servicios de Estructura.
 */
@Module({
  imports: [DatabaseModule, StructureModule, PlanningModule],
  controllers: [
    FieldJournalsController,
    FieldJournalEntriesController,
    FieldJournalReviewController,
    ObserverNotesController,
    ObserverNoteReviewController,
  ],
  providers: [
    FieldJournalsService,
    FieldJournalAuditSnapshot,
    { provide: FIELD_JOURNAL_REPOSITORY, useClass: PrismaFieldJournalRepository },
    ObserverNotesService,
    ObserverNoteAuditSnapshot,
    { provide: OBSERVER_NOTE_REPOSITORY, useClass: PrismaObserverNoteRepository },
  ],
})
export class FormatsModule {}

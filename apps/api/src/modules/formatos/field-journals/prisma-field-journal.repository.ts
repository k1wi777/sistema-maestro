import { Injectable } from '@nestjs/common';
import {
  AnnotationStatus,
  JournalStatus,
  ReviewAction,
  ReviewRecordType,
  type FieldJournalSortField,
  type JournalEventType,
} from '@gns/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  PrismaReadRepository,
  type ModelDelegate,
  type OrderByClause,
} from '../../../shared/repository/prisma-read.repository';
import type {
  AnnotationContent,
  AnnotationRow,
  ContributionRow,
  FieldJournalRecord,
  FieldJournalRepository,
  JournalBase,
  JournalChanges,
  JournalListExtras,
  JournalListFilters,
  JournalListItem,
  JournalVisibility,
  MissingEntry,
  NewAnnotation,
  NewSubmission,
  ObservationRow,
  ReviewScope,
  SubmissionRow,
} from './field-journal.repository';

// Datos anidados para no cruzar catálogos; nunca el correo del docente.
const LIST_INCLUDE = {
  group: { select: { id: true, name: true, grade: { select: { id: true, name: true } } } },
} satisfies Prisma.FieldJournalInclude;

const BASE_INCLUDE = {
  group: {
    select: {
      id: true,
      name: true,
      grade: {
        select: {
          id: true,
          name: true,
          coordinatorId: true,
          level: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  voidedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.FieldJournalInclude;

const ANNOTATION_INCLUDE = {
  teacher: { select: { id: true, fullName: true } },
  area: { select: { id: true, name: true } },
} satisfies Prisma.FieldJournalAnnotationInclude;

type ListRow = Prisma.FieldJournalGetPayload<{ include: typeof LIST_INCLUDE }>;
type AnnotationDbRow = Prisma.FieldJournalAnnotationGetPayload<{
  include: typeof ANNOTATION_INCLUDE;
}>;

const toDay = (value: Date): string => value.toISOString().slice(0, 10);
const READY_STATUSES: AnnotationStatus[] = [AnnotationStatus.Ready, AnnotationStatus.Observed];

const toAnnotation = (row: AnnotationDbRow): AnnotationRow => ({
  id: row.id,
  journalId: row.journalId,
  teacherId: row.teacher.id,
  teacherName: row.teacher.fullName,
  areaId: row.area.id,
  areaName: row.area.name,
  eventType: row.eventType as JournalEventType,
  studentNames: row.studentNames,
  description: row.description,
  actions: row.actions,
  reflection: row.reflection,
  status: row.status as AnnotationStatus,
  readyAt: row.readyAt,
  sent: row.sent,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Contenido como columnas de Prisma; `undefined` no se toca. */
const toAnnotationData = (content: AnnotationContent) => ({
  areaId: content.areaId,
  eventType: content.eventType,
  studentNames: content.students,
  description: content.description,
  actions: content.actions,
  reflection: content.reflection,
});

@Injectable()
export class PrismaFieldJournalRepository
  extends PrismaReadRepository<
    ListRow,
    Prisma.FieldJournalWhereInput,
    JournalListItem,
    JournalListFilters,
    FieldJournalSortField
  >
  implements FieldJournalRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findBase(id: string): Promise<JournalBase | null> {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { id },
      include: BASE_INCLUDE,
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      groupId: row.groupId,
      date: toDay(row.date),
      schoolYear: row.schoolYear,
      status: row.status as JournalStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
      voidedAt: row.voidedAt,
      createdBy: row.createdBy,
      voidedBy: row.voidedBy,
      group: { id: row.group.id, name: row.group.name },
      grade: {
        id: row.group.grade.id,
        name: row.group.grade.name,
        coordinatorId: row.group.grade.coordinatorId,
      },
      level: row.group.grade.level,
    };
  }

  async findByKey(groupId: string, date: string) {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { groupId_date: { groupId, date: new Date(date) } },
      select: { id: true, status: true, schoolYear: true },
    });
    return row
      ? { id: row.id, status: row.status as JournalStatus, schoolYear: row.schoolYear }
      : null;
  }

  async openOrCreate(input: {
    groupId: string;
    date: string;
    schoolYear: string;
    createdById: string;
  }): Promise<{ id: string; status: JournalStatus }> {
    await this.prisma.db.$executeRaw`
      INSERT INTO diario_campo (grupo_id, fecha, anio_lectivo, estado, creado_por)
      VALUES (${input.groupId}::uuid, ${input.date}::date, ${input.schoolYear},
              ${JournalStatus.InProgress}, ${input.createdById}::uuid)
      ON CONFLICT (grupo_id, fecha) DO NOTHING`;
    const rows = await this.prisma.db.$queryRaw<{ id: string; estado: string }[]>`
      SELECT id, estado FROM diario_campo
      WHERE grupo_id = ${input.groupId}::uuid AND fecha = ${input.date}::date FOR UPDATE`;
    const row = rows[0];
    if (!row) {
      throw new Error('El diario no existe tras crearlo');
    }
    return { id: row.id, status: row.estado as JournalStatus };
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM diario_campo WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async updateJournal(id: string, changes: JournalChanges): Promise<void> {
    await this.prisma.db.fieldJournal.update({ where: { id }, data: changes });
  }

  async touch(id: string): Promise<void> {
    await this.prisma.db.fieldJournal.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  // ---------- Anotaciones ----------

  async findAnnotations(journalId: string, viewerId: string): Promise<AnnotationRow[]> {
    const rows = await this.prisma.db.fieldJournalAnnotation.findMany({
      where: {
        journalId,
        OR: [{ status: { not: AnnotationStatus.Draft } }, { teacherId: viewerId }],
      },
      include: ANNOTATION_INCLUDE,
      orderBy: [{ readyAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toAnnotation);
  }

  async findAnnotation(journalId: string, annotationId: string): Promise<AnnotationRow | null> {
    const row = await this.prisma.db.fieldJournalAnnotation.findFirst({
      where: { id: annotationId, journalId },
      include: ANNOTATION_INCLUDE,
    });
    return row ? toAnnotation(row) : null;
  }

  async contributions(journalId: string): Promise<ContributionRow[]> {
    const rows = await this.prisma.db.fieldJournalAnnotation.findMany({
      where: { journalId },
      select: {
        teacherId: true,
        status: true,
        readyAt: true,
        teacher: { select: { fullName: true } },
        area: { select: { name: true } },
      },
    });
    const byTeacher = new Map<string, ContributionRow>();
    for (const row of rows) {
      const entry = byTeacher.get(row.teacherId) ?? {
        teacherId: row.teacherId,
        teacherName: row.teacher.fullName,
        ready: 0,
        drafts: 0,
        firstReadyAt: null,
        areaNames: [],
      };
      if (READY_STATUSES.includes(row.status as AnnotationStatus)) {
        entry.ready += 1;
        if (row.readyAt && (!entry.firstReadyAt || row.readyAt < entry.firstReadyAt)) {
          entry.firstReadyAt = row.readyAt;
        }
        if (!entry.areaNames.includes(row.area.name)) {
          entry.areaNames.push(row.area.name);
        }
      } else {
        entry.drafts += 1;
      }
      byTeacher.set(row.teacherId, entry);
    }
    return [...byTeacher.values()];
  }

  async insertAnnotation(journalId: string, annotation: NewAnnotation): Promise<void> {
    await this.prisma.db.fieldJournalAnnotation.create({
      data: {
        journalId,
        teacherId: annotation.teacherId,
        areaId: annotation.areaId,
        eventType: annotation.eventType,
        studentNames: annotation.students ?? null,
        description: annotation.description,
        actions: annotation.actions ?? null,
        reflection: annotation.reflection ?? null,
        status: AnnotationStatus.Draft,
      },
    });
  }

  async updateAnnotation(annotationId: string, content: AnnotationContent): Promise<void> {
    await this.prisma.db.fieldJournalAnnotation.update({
      where: { id: annotationId },
      data: toAnnotationData(content),
    });
  }

  async setAnnotationStatus(
    annotationId: string,
    state: { status: AnnotationStatus; readyAt: Date | null },
  ): Promise<void> {
    await this.prisma.db.fieldJournalAnnotation.update({
      where: { id: annotationId },
      data: { status: state.status, readyAt: state.readyAt },
    });
  }

  async markReadySent(journalId: string): Promise<void> {
    await this.prisma.db.fieldJournalAnnotation.updateMany({
      where: { journalId, status: AnnotationStatus.Ready },
      data: { sent: true },
    });
  }

  async markObserved(annotationIds: string[]): Promise<void> {
    await this.prisma.db.fieldJournalAnnotation.updateMany({
      where: { id: { in: annotationIds } },
      data: { status: AnnotationStatus.Observed },
    });
  }

  // ---------- Envíos y observaciones ----------

  async insertSubmission(submission: NewSubmission): Promise<void> {
    await this.prisma.db.fieldJournalSubmission.create({
      data: {
        journalId: submission.journalId,
        directorId: submission.directorId,
        submittedAt: submission.submittedAt,
        resubmission: submission.resubmission,
        readyCount: submission.readyCount,
        expectedCount: submission.expectedCount,
        missing: submission.missing.map((entry) => ({
          docenteId: entry.teacherId,
          estado: entry.status,
        })),
      },
    });
  }

  async findSubmissions(journalId: string): Promise<SubmissionRow[]> {
    const rows = await this.prisma.db.fieldJournalSubmission.findMany({
      where: { journalId },
      include: { director: { select: { id: true, fullName: true } } },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      directorId: row.director.id,
      directorName: row.director.fullName,
      submittedAt: row.submittedAt,
      resubmission: row.resubmission,
      readyCount: row.readyCount,
      expectedCount: row.expectedCount,
      missing: (row.missing as { docenteId: string; estado: MissingEntry['status'] }[]).map(
        (entry) => ({ teacherId: entry.docenteId, status: entry.estado }),
      ),
    }));
  }

  async insertObservations(
    reviewId: string,
    observations: { annotationId: string; text: string }[],
  ): Promise<void> {
    if (observations.length === 0) {
      return;
    }
    await this.prisma.db.fieldJournalObservation.createMany({
      data: observations.map((observation) => ({ reviewId, ...observation })),
    });
  }

  async findObservations(journalId: string): Promise<ObservationRow[]> {
    const rows = await this.prisma.db.fieldJournalObservation.findMany({
      where: { annotation: { journalId } },
      include: { review: { include: { reviewer: { select: { id: true, fullName: true } } } } },
      orderBy: [{ review: { date: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      reviewId: row.reviewId,
      annotationId: row.annotationId,
      text: row.text,
      reviewer: row.review.reviewer,
      date: row.review.date,
    }));
  }

  findUsers(ids: string[]): Promise<{ id: string; fullName: string }[]> {
    return this.prisma.db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
  }

  // ---------- Listados ----------

  async findListExtras(ids: string[], viewerId: string): Promise<Map<string, JournalListExtras>> {
    const extras = new Map<string, JournalListExtras>(
      ids.map((id) => [
        id,
        { readyTeachers: 0, lastSubmission: null, review: null, myObserved: 0 },
      ]),
    );
    if (ids.length === 0) {
      return extras;
    }
    const [ready, submissions, reviews, mine] = await Promise.all([
      this.prisma.db.fieldJournalAnnotation.groupBy({
        by: ['journalId', 'teacherId'],
        where: { journalId: { in: ids }, status: { in: READY_STATUSES } },
      }),
      this.prisma.db.fieldJournalSubmission.findMany({
        where: { journalId: { in: ids } },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.db.review.findMany({
        where: { recordType: ReviewRecordType.FieldJournal, recordId: { in: ids } },
        include: { reviewer: { select: { id: true, fullName: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.db.fieldJournalAnnotation.groupBy({
        by: ['journalId'],
        where: {
          journalId: { in: ids },
          teacherId: viewerId,
          status: AnnotationStatus.Observed,
        },
        _count: { _all: true },
      }),
    ]);
    for (const row of ready) {
      const entry = extras.get(row.journalId);
      if (entry) {
        entry.readyTeachers += 1;
      }
    }
    for (const row of submissions) {
      const entry = extras.get(row.journalId);
      if (entry && !entry.lastSubmission) {
        entry.lastSubmission = { readyCount: row.readyCount, expectedCount: row.expectedCount };
      }
    }
    for (const row of reviews) {
      const entry = extras.get(row.recordId);
      if (entry && !entry.review) {
        entry.review = {
          reviewer: row.reviewer,
          date: row.date,
          approved: row.action === ReviewAction.Approved,
        };
      }
    }
    for (const row of mine) {
      const entry = extras.get(row.journalId);
      if (entry) {
        entry.myObserved = row._count._all;
      }
    }
    return extras;
  }

  async findByGroupsAndDate(groupIds: string[], date: string): Promise<JournalListItem[]> {
    const rows = await this.prisma.db.fieldJournal.findMany({
      where: { groupId: { in: groupIds }, date: new Date(date) },
      include: LIST_INCLUDE,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async countByStatus(
    visibility: JournalVisibility,
  ): Promise<Partial<Record<JournalStatus, number>>> {
    const rows = await this.prisma.db.fieldJournal.groupBy({
      by: ['status'],
      where: this.visibilityWhere(visibility),
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  async findReviewScope(coordinatorId: string | null): Promise<ReviewScope> {
    const grades = await this.prisma.db.grade.findMany({
      where: coordinatorId ? { coordinatorId } : {},
      select: {
        id: true,
        name: true,
        groups: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      grades: grades.map((grade) => ({ id: grade.id, name: grade.name })),
      groups: grades.flatMap((grade) =>
        grade.groups
          .map((group) => ({ id: group.id, name: group.name, gradeId: grade.id }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
      ),
    };
  }

  async findRecordById(id: string): Promise<FieldJournalRecord | null> {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { id },
      include: {
        group: { select: { name: true } },
        annotations: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { observations: { orderBy: { id: 'asc' } } },
        },
        submissions: { orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }], take: 1 },
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      groupId: row.groupId,
      groupName: row.group.name,
      date: toDay(row.date),
      schoolYear: row.schoolYear,
      status: row.status as JournalStatus,
      createdById: row.createdById,
      submittedAt: row.submittedAt,
      voidedAt: row.voidedAt,
      voidedById: row.voidedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSubmission: row.submissions[0]
        ? {
            readyCount: row.submissions[0].readyCount,
            expectedCount: row.submissions[0].expectedCount,
          }
        : null,
      annotations: row.annotations.map((annotation) => ({
        id: annotation.id,
        teacherId: annotation.teacherId,
        areaId: annotation.areaId,
        eventType: annotation.eventType,
        studentNames: annotation.studentNames,
        description: annotation.description,
        actions: annotation.actions,
        reflection: annotation.reflection,
        status: annotation.status,
        readyAt: annotation.readyAt,
        sent: annotation.sent,
      })),
      observations: row.annotations.flatMap((annotation) =>
        annotation.observations.map((observation) => ({
          id: observation.id,
          reviewId: observation.reviewId,
          annotationId: observation.annotationId,
          text: observation.text,
        })),
      ),
    };
  }

  protected get delegate(): ModelDelegate<ListRow, Prisma.FieldJournalWhereInput> {
    const model = this.prisma.db.fieldJournal;
    return {
      findMany: (args) => model.findMany({ ...args, include: LIST_INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: LIST_INCLUDE }),
    };
  }

  private visibilityWhere(visibility: JournalVisibility): Prisma.FieldJournalWhereInput {
    if (visibility.kind === 'mine') {
      return {
        OR: [
          { groupId: { in: visibility.groupIds } },
          { annotations: { some: { teacherId: visibility.userId } } },
        ],
      };
    }
    // La coordinadora recibe el diario solo desde el primer envío; administración ve todos.
    return visibility.coordinatorId
      ? {
          submittedAt: { not: null },
          group: { grade: { coordinatorId: visibility.coordinatorId } },
        }
      : {};
  }

  protected toWhere(filters: JournalListFilters): Prisma.FieldJournalWhereInput {
    const { visibility, ...rest } = filters;
    return {
      AND: [
        this.visibilityWhere(visibility),
        {
          status: rest.status,
          groupId: rest.groupId,
          group: rest.gradeId ? { gradeId: rest.gradeId } : undefined,
          date: {
            gte: rest.from ? new Date(rest.from) : undefined,
            lte: rest.to ? new Date(rest.to) : undefined,
          },
        },
      ],
    };
  }

  // PostgreSQL pone los NULL primero en DESC: sin esto los diarios nunca enviados encabezarían
  // la lista al ordenar por fecha de envío.
  protected override orderBy(field: FieldJournalSortField, order: 'asc' | 'desc'): OrderByClause {
    return field === 'submittedAt'
      ? { submittedAt: { sort: order, nulls: 'last' } }
      : super.orderBy(field, order);
  }

  protected toEntity(row: ListRow): JournalListItem {
    return {
      id: row.id,
      groupId: row.group.id,
      groupName: row.group.name,
      gradeId: row.group.grade.id,
      gradeName: row.group.grade.name,
      date: toDay(row.date),
      schoolYear: row.schoolYear,
      status: row.status as JournalStatus,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

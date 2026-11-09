import { Injectable } from '@nestjs/common';
import {
  RecordStatus,
  splitStudents,
  type FieldJournal,
  type FieldJournalEntry,
  type FieldJournalFilters,
  type FieldJournalSortField,
  type FieldJournalSummary,
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
  FieldJournalChanges,
  FieldJournalRecord,
  FieldJournalRepository,
  JournalEntryContent,
  NewFieldJournal,
  NewJournalEntry,
} from './field-journal.repository';

// Datos anidados para no cruzar catálogos; nunca el correo del docente.
const LIST_INCLUDE = {
  teacher: { select: { id: true, fullName: true } },
  grade: { select: { id: true, name: true } },
  period: { select: { id: true, number: true, schoolYear: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.FieldJournalInclude;

const ENTRY_ORDER = [
  { date: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.FieldJournalEntryOrderByWithRelationInput[];

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  entries: { orderBy: ENTRY_ORDER },
} satisfies Prisma.FieldJournalInclude;

type JournalListRow = Prisma.FieldJournalGetPayload<{ include: typeof LIST_INCLUDE }>;
type JournalDetailRow = Prisma.FieldJournalGetPayload<{ include: typeof DETAIL_INCLUDE }>;
type EntryRow = Prisma.FieldJournalEntryGetPayload<object>;

const toDay = (value: Date): string => value.toISOString().slice(0, 10);

/** Contenido como columnas de Prisma: la fecha `AAAA-MM-DD` pasa a `Date`; `undefined` no se toca. */
function toEntryData(content: JournalEntryContent) {
  return {
    date: content.date === undefined ? undefined : new Date(content.date),
    lesson: content.lesson,
    eventType: content.eventType,
    studentNames: content.students,
    description: content.description,
    actions: content.actions,
    reflection: content.reflection,
  };
}

const toEntry = (row: EntryRow): FieldJournalEntry => ({
  id: row.id,
  date: toDay(row.date),
  lesson: row.lesson,
  eventType: row.eventType as JournalEventType,
  students: splitStudents(row.studentNames),
  description: row.description,
  actions: row.actions,
  reflection: row.reflection,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class PrismaFieldJournalRepository
  extends PrismaReadRepository<
    JournalListRow,
    Prisma.FieldJournalWhereInput,
    FieldJournalSummary,
    FieldJournalFilters,
    FieldJournalSortField
  >
  implements FieldJournalRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  override async findById(id: string): Promise<FieldJournal | null> {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    return row ? this.toDetail(row) : null;
  }

  async findRecordById(id: string): Promise<FieldJournalRecord | null> {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { id },
      include: { entries: { orderBy: ENTRY_ORDER } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      teacherId: row.teacherId,
      gradeId: row.gradeId,
      periodId: row.periodId,
      status: row.status as RecordStatus,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      entries: row.entries.map((entry) => ({
        id: entry.id,
        date: toDay(entry.date),
        lesson: entry.lesson,
        eventType: entry.eventType,
        studentNames: entry.studentNames,
        description: entry.description,
        actions: entry.actions,
        reflection: entry.reflection,
      })),
    };
  }

  async findByKey(teacherId: string, gradeId: string, periodId: string) {
    const row = await this.prisma.db.fieldJournal.findUnique({
      where: { teacherId_gradeId_periodId: { teacherId, gradeId, periodId } },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, status: row.status as RecordStatus } : null;
  }

  async create(input: NewFieldJournal): Promise<FieldJournal> {
    const row = await this.prisma.db.fieldJournal.create({
      data: { ...input, status: RecordStatus.Draft },
      include: DETAIL_INCLUDE,
    });
    return this.toDetail(row);
  }

  async updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: FieldJournalChanges,
  ): Promise<boolean> {
    const { count } = await this.prisma.db.fieldJournal.updateMany({
      where: { id, status: { in: [...from] } },
      data: changes,
    });
    return count === 1;
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM diario_campo WHERE id = ${id}::uuid FOR UPDATE`;
  }

  countEntries(journalId: string): Promise<number> {
    return this.prisma.db.fieldJournalEntry.count({ where: { journalId } });
  }

  async addEntry(journalId: string, entry: NewJournalEntry): Promise<void> {
    await this.prisma.db.fieldJournalEntry.create({
      data: {
        journalId,
        date: new Date(entry.date),
        lesson: entry.lesson,
        eventType: entry.eventType,
        studentNames: entry.students ?? null,
        description: entry.description,
        actions: entry.actions ?? null,
        reflection: entry.reflection ?? null,
      },
    });
  }

  async updateEntry(
    journalId: string,
    entryId: string,
    content: JournalEntryContent,
  ): Promise<boolean> {
    const { count } = await this.prisma.db.fieldJournalEntry.updateMany({
      where: { id: entryId, journalId },
      data: toEntryData(content),
    });
    return count === 1;
  }

  async removeEntry(journalId: string, entryId: string): Promise<boolean> {
    const { count } = await this.prisma.db.fieldJournalEntry.deleteMany({
      where: { id: entryId, journalId },
    });
    return count === 1;
  }

  async touch(journalId: string): Promise<void> {
    await this.prisma.db.fieldJournal.update({
      where: { id: journalId },
      data: { updatedAt: new Date() },
    });
  }

  protected get delegate(): ModelDelegate<JournalListRow, Prisma.FieldJournalWhereInput> {
    const model = this.prisma.db.fieldJournal;
    return {
      findMany: (args) => model.findMany({ ...args, include: LIST_INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: LIST_INCLUDE }),
    };
  }

  protected toWhere(filters: FieldJournalFilters): Prisma.FieldJournalWhereInput {
    return {
      teacherId: filters.teacherId,
      status: filters.status,
      gradeId: filters.gradeId,
      periodId: filters.periodId,
    };
  }

  // PostgreSQL pone los NULL primero en DESC: sin esto los borradores (nunca enviados)
  // encabezarían la bandeja al ordenar por fecha de envío.
  protected override orderBy(field: FieldJournalSortField, order: 'asc' | 'desc'): OrderByClause {
    return field === 'submittedAt'
      ? { submittedAt: { sort: order, nulls: 'last' } }
      : super.orderBy(field, order);
  }

  protected toEntity(row: JournalListRow): FieldJournalSummary {
    return {
      id: row.id,
      teacher: { id: row.teacher.id, fullName: row.teacher.fullName },
      grade: { id: row.grade.id, name: row.grade.name },
      period: { id: row.period.id, number: row.period.number, schoolYear: row.period.schoolYear },
      status: row.status as RecordStatus,
      submittedAt: row.submittedAt,
      entryCount: row._count.entries,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDetail(row: JournalDetailRow): FieldJournal {
    return { ...this.toEntity(row), entries: row.entries.map(toEntry) };
  }
}

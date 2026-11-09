import { Injectable } from '@nestjs/common';
import {
  OBSERVER_PRIORITY_TYPES,
  RecordStatus,
  type ListQuery,
  type ObserverNote,
  type ObserverNoteSortField,
  type ObserverNoteType,
  type Page,
} from '@gns/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { TransactionClient } from '../../../shared/database/transaction-context';
import {
  PrismaReadRepository,
  countPages,
  toPageWindow,
  type ModelDelegate,
} from '../../../shared/repository/prisma-read.repository';
import type {
  NewObserverNote,
  ObserverNoteChanges,
  ObserverNoteContent,
  ObserverNoteQueryFilters,
  ObserverNoteRecord,
  ObserverNoteRepository,
} from './observer-note.repository';
import { splitPriorityWindow } from './observer-priority';

const INCLUDE = {
  teacher: { select: { id: true, fullName: true } },
  grade: { select: { id: true, name: true } },
} satisfies Prisma.ObserverNoteInclude;

type ObserverNoteRow = Prisma.ObserverNoteGetPayload<{ include: typeof INCLUDE }>;

const toDay = (value: Date): string => value.toISOString().slice(0, 10);

function toData(content: ObserverNoteContent) {
  return {
    studentFirstName: content.studentFirstName,
    date: content.date === undefined ? undefined : new Date(content.date),
    type: content.type,
    description: content.description,
    studentVersion: content.studentVersion,
    actions: content.actions,
    familyInformed: content.familyInformed,
    followUp: content.followUp,
  };
}

@Injectable()
export class PrismaObserverNoteRepository
  extends PrismaReadRepository<
    ObserverNoteRow,
    Prisma.ObserverNoteWhereInput,
    ObserverNote,
    ObserverNoteQueryFilters,
    ObserverNoteSortField
  >
  implements ObserverNoteRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findRecordById(id: string): Promise<ObserverNoteRecord | null> {
    const row = await this.prisma.db.observerNote.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      teacherId: row.teacherId,
      gradeId: row.gradeId,
      studentFirstName: row.studentFirstName,
      date: toDay(row.date),
      type: row.type,
      description: row.description,
      studentVersion: row.studentVersion,
      actions: row.actions,
      familyInformed: row.familyInformed,
      followUp: row.followUp,
      status: row.status as RecordStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(input: NewObserverNote): Promise<ObserverNote> {
    const { teacherId, gradeId, ...content } = input;
    const row = await this.prisma.db.observerNote.create({
      data: {
        teacherId,
        gradeId,
        studentFirstName: input.studentFirstName,
        date: new Date(input.date),
        type: input.type,
        description: input.description,
        studentVersion: content.studentVersion ?? null,
        actions: content.actions ?? null,
        familyInformed: content.familyInformed ?? false,
        followUp: content.followUp ?? null,
        status: RecordStatus.Draft,
      },
      include: INCLUDE,
    });
    return this.toEntity(row);
  }

  async updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: ObserverNoteChanges,
  ): Promise<boolean> {
    const { status, ...content } = changes;
    const { count } = await this.prisma.db.observerNote.updateMany({
      where: { id, status: { in: [...from] } },
      data: { ...toData(content), status },
    });
    return count === 1;
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db
      .$queryRaw`SELECT id FROM observador_anotacion WHERE id = ${id}::uuid FOR UPDATE`;
  }

  /**
   * `priority` pone primero los tipo II y III: el segmento prioritario y el resto se cuentan y
   * se pagina cada uno con su ventana (`splitPriorityWindow`). Otros órdenes usan la base.
   */
  override async findPage(
    query: ListQuery<ObserverNoteQueryFilters, ObserverNoteSortField>,
  ): Promise<Page<ObserverNote>> {
    if (query.sort.field !== 'priority') {
      return super.findPage(query);
    }
    if (this.prisma.inTransaction) {
      return this.findPriorityPage(this.prisma.db, query);
    }
    return this.prisma.$transaction((tx) => this.findPriorityPage(tx, query));
  }

  private async findPriorityPage(
    db: TransactionClient,
    query: ListQuery<ObserverNoteQueryFilters, ObserverNoteSortField>,
  ): Promise<Page<ObserverNote>> {
    const base = this.toWhere(query.filters);
    const priorityTypes = [...OBSERVER_PRIORITY_TYPES] as ObserverNoteType[];
    const priorityWhere: Prisma.ObserverNoteWhereInput = {
      AND: [base, { type: { in: priorityTypes } }],
    };
    const restWhere: Prisma.ObserverNoteWhereInput = {
      AND: [base, { type: { notIn: priorityTypes } }],
    };
    const orderBy: Prisma.ObserverNoteOrderByWithRelationInput[] = [
      { date: query.sort.order },
      { createdAt: 'desc' },
      { id: 'asc' },
    ];

    const [priorityCount, restCount] = [
      await db.observerNote.count({ where: priorityWhere }),
      await db.observerNote.count({ where: restWhere }),
    ];
    const { skip, take } = toPageWindow(query.page, query.pageSize);
    const window = splitPriorityWindow(skip, take, priorityCount);
    const find = (where: Prisma.ObserverNoteWhereInput, part: { skip: number; take: number }) =>
      part.take > 0
        ? db.observerNote.findMany({ where, orderBy, include: INCLUDE, ...part })
        : Promise.resolve([] as ObserverNoteRow[]);
    const rows = [
      ...(await find(priorityWhere, window.priority)),
      ...(await find(restWhere, window.rest)),
    ];

    const totalItems = priorityCount + restCount;
    return {
      items: rows.map((row) => this.toEntity(row)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: countPages(totalItems, query.pageSize),
    };
  }

  protected get delegate(): ModelDelegate<ObserverNoteRow, Prisma.ObserverNoteWhereInput> {
    const model = this.prisma.db.observerNote;
    return {
      findMany: (args) => model.findMany({ ...args, include: INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: INCLUDE }),
    };
  }

  protected toWhere(filters: ObserverNoteQueryFilters): Prisma.ObserverNoteWhereInput {
    const hasRange = filters.dateFrom !== undefined || filters.dateTo !== undefined;
    return {
      teacherId: filters.teacherId,
      status: filters.status,
      gradeId: filters.gradeId,
      type: filters.type,
      date: hasRange
        ? {
            gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
            lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
          }
        : undefined,
    };
  }

  protected toEntity(row: ObserverNoteRow): ObserverNote {
    return {
      id: row.id,
      teacher: { id: row.teacher.id, fullName: row.teacher.fullName },
      grade: { id: row.grade.id, name: row.grade.name },
      studentFirstName: row.studentFirstName,
      date: toDay(row.date),
      type: row.type as ObserverNoteType,
      description: row.description,
      studentVersion: row.studentVersion,
      actions: row.actions,
      familyInformed: row.familyInformed,
      followUp: row.followUp,
      status: row.status as RecordStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

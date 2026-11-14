import { Injectable } from '@nestjs/common';
import {
  UNANSWERED_LIST_OCCURRENCES,
  UnansweredQuestionStatus,
  type ListQuery,
  type Page,
  type UnansweredFilters,
  type UnansweredQuestion,
  type UnansweredSortField,
} from '@gns/shared';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { countPages, toPageWindow } from '../../../shared/repository/prisma-read.repository';
import type {
  CloseUnansweredInput,
  RecordOccurrenceInput,
  UnansweredRepository,
} from './unanswered.repository';

/** Del autor solo el id y el nombre (personal adulto): nunca correo ni rol. */
const OCCURRENCE_AUTHOR = { select: { id: true, fullName: true } } as const;

const occurrencesInclude = (take?: number) =>
  ({
    occurrences: {
      orderBy: [{ askedAt: 'desc' }, { id: 'asc' }],
      ...(take === undefined ? {} : { take }),
      include: { user: OCCURRENCE_AUTHOR },
    },
  }) satisfies Prisma.UnansweredQuestionInclude;

type GroupRow = Prisma.UnansweredQuestionGetPayload<object>;
type GroupWithOccurrences = Prisma.UnansweredQuestionGetPayload<{
  include: ReturnType<typeof occurrencesInclude>;
}>;

const toQuestion = (
  row: GroupRow & { occurrences?: GroupWithOccurrences['occurrences'] },
): UnansweredQuestion => ({
  id: row.id,
  text: row.text,
  times: row.times,
  firstAskedAt: row.firstAskedAt,
  lastAskedAt: row.lastAskedAt,
  status: row.status as UnansweredQuestion['status'],
  faqId: row.faqId,
  closedAt: row.closedAt,
  occurrences: (row.occurrences ?? []).map((occurrence) => ({
    id: occurrence.id,
    user: { id: occurrence.user.id, name: occurrence.user.fullName },
    askedAt: occurrence.askedAt,
  })),
});

@Injectable()
export class PrismaUnansweredRepository implements UnansweredRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UnansweredQuestion | null> {
    const row = await this.prisma.db.unansweredQuestion.findUnique({
      where: { id },
      include: occurrencesInclude(),
    });
    return row ? toQuestion(row) : null;
  }

  async findGroup(id: string): Promise<UnansweredQuestion | null> {
    const row = await this.prisma.db.unansweredQuestion.findUnique({ where: { id } });
    return row ? toQuestion(row) : null;
  }

  async findPage(
    query: ListQuery<UnansweredFilters, UnansweredSortField>,
  ): Promise<Page<UnansweredQuestion>> {
    const where: Prisma.UnansweredQuestionWhereInput =
      query.filters.status === undefined ? {} : { status: query.filters.status };
    const { skip, take } = toPageWindow(query.page, query.pageSize);
    const { field, order } = query.sort;
    // Los desempates dan un orden total: sin ellos, valores repetidos repetirían u omitirían
    // filas entre páginas.
    const orderBy: Prisma.UnansweredQuestionOrderByWithRelationInput[] =
      field === 'times'
        ? [{ times: order }, { lastAskedAt: 'desc' }, { id: 'asc' }]
        : [{ lastAskedAt: order }, { times: 'desc' }, { id: 'asc' }];
    const delegate = this.prisma.db.unansweredQuestion;
    const count = delegate.count({ where });
    const rows = delegate.findMany({
      where,
      orderBy,
      skip,
      take,
      include: occurrencesInclude(UNANSWERED_LIST_OCCURRENCES),
    });

    // Dentro de una transacción las dos consultas ya comparten el mismo cliente.
    const [totalItems, found] = this.prisma.inTransaction
      ? [await count, await rows]
      : await this.prisma.$transaction([count, rows]);

    return {
      items: found.map(toQuestion),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: countPages(totalItems, query.pageSize),
    };
  }

  // El texto de la persona viaja solo como parámetro de la plantilla etiquetada. El índice único
  // parcial hace atómico el «sumar o crear»: dos preguntas iguales a la vez no duplican la fila.
  async recordOccurrence(input: RecordOccurrenceInput): Promise<string> {
    const rows = await this.prisma.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO pregunta_sin_respuesta (texto, texto_normalizado, veces, primera_vez, ultima_vez)
      VALUES (${input.text}, ${input.normalizedText}, 1, ${input.at}::timestamptz, ${input.at}::timestamptz)
      ON CONFLICT (texto_normalizado) WHERE estado = 'pendiente'
      DO UPDATE SET veces = pregunta_sin_respuesta.veces + 1,
                    ultima_vez = EXCLUDED.ultima_vez,
                    actualizado_en = CURRENT_TIMESTAMP
      RETURNING id::text AS id
    `);
    const groupId = rows[0]?.id;
    if (!groupId) {
      throw new Error('El registro de la pregunta sin respuesta no devolvió su id');
    }
    await this.prisma.db.unansweredQuestionOccurrence.create({
      data: { unansweredQuestionId: groupId, userId: input.userId, askedAt: input.at },
    });
    return groupId;
  }

  async close(id: string, input: CloseUnansweredInput): Promise<boolean> {
    const result = await this.prisma.db.unansweredQuestion.updateMany({
      where: { id, status: UnansweredQuestionStatus.Pending },
      data: {
        status: input.status,
        // El texto puede nombrar a menores y deja de hacer falta al cerrarse.
        text: null,
        normalizedText: null,
        faqId: input.faqId,
        closedById: input.closedById,
        closedAt: input.closedAt,
      },
    });
    return result.count > 0;
  }
}

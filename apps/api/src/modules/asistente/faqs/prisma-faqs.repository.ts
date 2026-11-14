import { Injectable } from '@nestjs/common';
import type {
  CreateFaqInput,
  FaqAdminView,
  FaqFilters,
  FaqSortField,
  FaqView,
  UpdateFaqInput,
} from '@gns/shared';
import type { FaqEntry as FaqRow, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../shared/repository/prisma-read.repository';
import type { FaqsRepository } from './faqs.repository';

/** Orden de lectura del asistente: categoría y pregunta (R1). */
const READING_ORDER = [
  { category: 'asc' },
  { question: 'asc' },
  { id: 'asc' },
] satisfies Prisma.FaqEntryOrderByWithRelationInput[];

@Injectable()
export class PrismaFaqsRepository
  extends PrismaReadRepository<
    FaqRow,
    Prisma.FaqEntryWhereInput,
    FaqAdminView,
    FaqFilters,
    FaqSortField
  >
  implements FaqsRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findActive(): Promise<FaqView[]> {
    const rows = await this.prisma.db.faqEntry.findMany({
      where: { isActive: true },
      orderBy: READING_ORDER,
    });
    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      question: row.question,
      answer: row.answer,
      source: row.source,
    }));
  }

  async create(
    input: Omit<CreateFaqInput, 'unansweredQuestionId'>,
    userId: string,
  ): Promise<FaqAdminView> {
    const row = await this.prisma.db.faqEntry.create({
      data: {
        category: input.category,
        question: input.question,
        answer: input.answer,
        keywords: input.keywords ?? null,
        source: input.source ?? null,
        isActive: input.isActive,
        updatedById: userId,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, input: UpdateFaqInput, userId: string): Promise<FaqAdminView> {
    const row = await this.prisma.db.faqEntry.update({
      where: { id },
      data: { ...input, updatedById: userId },
    });
    return this.toEntity(row);
  }

  protected get delegate() {
    return this.prisma.db.faqEntry;
  }

  protected override tieBreakers(field: FaqSortField): Record<string, 'asc' | 'desc'>[] {
    return field === 'category' ? [{ question: 'asc' }, { id: 'asc' }] : [{ id: 'asc' }];
  }

  protected toWhere(filters: FaqFilters): Prisma.FaqEntryWhereInput {
    return {
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.category !== undefined ? { category: filters.category } : {}),
    };
  }

  protected toEntity(row: FaqRow): FaqAdminView {
    return {
      id: row.id,
      category: row.category,
      question: row.question,
      answer: row.answer,
      source: row.source,
      keywords: row.keywords,
      isActive: row.isActive,
      updatedById: row.updatedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

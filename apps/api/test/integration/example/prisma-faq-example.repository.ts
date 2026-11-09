import { Injectable } from '@nestjs/common';
import type { FaqEntry, Prisma } from '../../../src/generated/prisma/client';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { PrismaReadRepository } from '../../../src/shared/repository/prisma-read.repository';
import type {
  FaqExample,
  FaqExampleInput,
  FaqExampleFilters,
  FaqExampleRepository,
  FaqExampleSortField,
} from './faq-example.repository';

@Injectable()
export class PrismaFaqExampleRepository
  extends PrismaReadRepository<
    FaqEntry,
    Prisma.FaqEntryWhereInput,
    FaqExample,
    FaqExampleFilters,
    FaqExampleSortField
  >
  implements FaqExampleRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(input: FaqExampleInput): Promise<FaqExample> {
    return this.toEntity(await this.prisma.db.faqEntry.create({ data: input }));
  }

  async update(id: string, input: Partial<FaqExampleInput>): Promise<FaqExample> {
    // Prisma lanza P2025 si el registro no existe: el filtro global lo responde como 404.
    return this.toEntity(await this.prisma.db.faqEntry.update({ where: { id }, data: input }));
  }

  protected get delegate() {
    return this.prisma.db.faqEntry;
  }

  protected toWhere(filters: FaqExampleFilters) {
    return { category: filters.category, isActive: filters.isActive };
  }

  protected toEntity(row: FaqEntry): FaqExample {
    return {
      id: row.id,
      category: row.category,
      question: row.question,
      answer: row.answer,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}

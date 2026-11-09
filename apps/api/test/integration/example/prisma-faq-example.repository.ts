import { Injectable } from '@nestjs/common';
import type { FaqEntry, Prisma } from '../../../src/generated/prisma/client';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { PrismaReadRepository } from '../../../src/shared/repository/prisma-read.repository';
import type {
  FaqExample,
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

  protected get delegate() {
    return this.prisma.faqEntry;
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

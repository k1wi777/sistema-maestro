import type { ReadRepository } from '../../../src/shared/repository/repository';

export interface FaqExample {
  id: string;
  category: string;
  question: string;
  answer: string;
  isActive: boolean;
  createdAt: Date;
}

export interface FaqExampleFilters {
  category?: string;
  isActive?: boolean;
}

export const FAQ_EXAMPLE_SORT_FIELDS = ['question', 'createdAt'] as const;
export type FaqExampleSortField = (typeof FAQ_EXAMPLE_SORT_FIELDS)[number];

export interface FaqExampleInput {
  category: string;
  question: string;
  answer: string;
  isActive: boolean;
}

export interface FaqExampleRepository extends ReadRepository<
  FaqExample,
  FaqExampleFilters,
  FaqExampleSortField
> {
  create(input: FaqExampleInput): Promise<FaqExample>;
  update(id: string, input: Partial<FaqExampleInput>): Promise<FaqExample>;
}

export const FAQ_EXAMPLE_REPOSITORY = Symbol('FAQ_EXAMPLE_REPOSITORY');

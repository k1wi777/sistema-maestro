import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ListQuery, Page } from '@gns/shared';
import {
  FAQ_EXAMPLE_REPOSITORY,
  type FaqExample,
  type FaqExampleFilters,
  type FaqExampleInput,
  type FaqExampleRepository,
  type FaqExampleSortField,
} from './faq-example.repository';

@Injectable()
export class FaqExampleService {
  constructor(@Inject(FAQ_EXAMPLE_REPOSITORY) private readonly repository: FaqExampleRepository) {}

  list(query: ListQuery<FaqExampleFilters, FaqExampleSortField>): Promise<Page<FaqExample>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<FaqExample | null> {
    return this.repository.findById(id);
  }

  create(input: FaqExampleInput): Promise<FaqExample> {
    return this.repository.create(input);
  }

  update(id: string, input: Partial<FaqExampleInput>): Promise<FaqExample> {
    return this.repository.update(id, input);
  }

  async get(id: string): Promise<FaqExample> {
    const entry = await this.find(id);
    if (!entry) {
      throw new NotFoundException('Pregunta frecuente no encontrada');
    }
    return entry;
  }
}

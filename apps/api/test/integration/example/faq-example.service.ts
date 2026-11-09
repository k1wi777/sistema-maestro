import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ListQuery, Page } from '@gns/shared';
import {
  FAQ_EXAMPLE_REPOSITORY,
  type FaqExample,
  type FaqExampleFilters,
  type FaqExampleRepository,
  type FaqExampleSortField,
} from './faq-example.repository';

@Injectable()
export class FaqExampleService {
  constructor(@Inject(FAQ_EXAMPLE_REPOSITORY) private readonly repository: FaqExampleRepository) {}

  list(query: ListQuery<FaqExampleFilters, FaqExampleSortField>): Promise<Page<FaqExample>> {
    return this.repository.findPage(query);
  }

  async get(id: string): Promise<FaqExample> {
    const entry = await this.repository.findById(id);
    if (!entry) {
      throw new NotFoundException('Pregunta frecuente no encontrada');
    }
    return entry;
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { createListQuerySchema, queryBoolean, type ListQuery, type Page } from '@gns/shared';
import { z } from 'zod';
import { ListQueryPipe } from '../../../src/shared/pagination/list-query.pipe';
import { FAQ_EXAMPLE_SORT_FIELDS, type FaqExample } from './faq-example.repository';
import type { FaqExampleFilters, FaqExampleSortField } from './faq-example.repository';
import { FaqExampleService } from './faq-example.service';

const faqExampleListQuery = createListQuerySchema({
  sortFields: FAQ_EXAMPLE_SORT_FIELDS,
  defaultSort: { field: 'createdAt', order: 'desc' },
  filters: { category: z.string().min(1).optional(), isActive: queryBoolean.optional() },
});

@Controller('faq-example')
export class FaqExampleController {
  constructor(private readonly service: FaqExampleService) {}

  @Get()
  list(
    @Query(new ListQueryPipe(faqExampleListQuery))
    query: ListQuery<FaqExampleFilters, FaqExampleSortField>,
  ): Promise<Page<FaqExample>> {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<FaqExample> {
    return this.service.get(id);
  }
}

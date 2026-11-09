import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../src/core/audit/audited.decorator';
import { FaqExampleAuditSnapshot } from './faq-example.audit-snapshot';
import {
  CreateFaqExampleDto,
  FaqExampleDto,
  FaqExampleListQueryDto,
  FaqExamplePageDto,
  IdParamDto,
  UpdateFaqExampleDto,
} from './faq-example.dto';
import { FaqExampleService } from './faq-example.service';

@Controller('faq-example')
export class FaqExampleController {
  constructor(private readonly service: FaqExampleService) {}

  @Get()
  @ZodResponse({ status: 200, type: FaqExamplePageDto })
  list(@Query() query: FaqExampleListQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: FaqExampleDto })
  get(@Param() { id }: IdParamDto) {
    return this.service.get(id);
  }

  @Post()
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Crear pregunta frecuente',
    entity: 'pregunta_frecuente',
    snapshot: FaqExampleAuditSnapshot,
  })
  @ZodResponse({ status: 201, type: FaqExampleDto })
  create(@Body() body: CreateFaqExampleDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Editar pregunta frecuente',
    entity: 'pregunta_frecuente',
    snapshot: FaqExampleAuditSnapshot,
  })
  @ZodResponse({ status: 200, type: FaqExampleDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateFaqExampleDto) {
    return this.service.update(id, body);
  }
}

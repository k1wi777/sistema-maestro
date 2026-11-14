import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { FaqAuditSnapshot } from './faq.audit-snapshot';
import {
  CreateFaqDto,
  FaqAdminDto,
  FaqAdminPageDto,
  FaqListDto,
  FaqListQueryDto,
  UpdateFaqDto,
} from './faqs.dto';
import { FaqsService } from './faqs.service';

const AUDIT = {
  type: AuditLogType.Assistant,
  entity: 'pregunta_frecuente',
  snapshot: FaqAuditSnapshot,
};

/** Preguntas activas para cualquier rol (R1): sin palabras clave ni autoría. */
@Controller('assistant/faqs')
@RequireRole(UserRole.Teacher)
export class AssistantFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ZodResponse({ status: 200, type: FaqListDto })
  list() {
    return this.faqs.listActive();
  }
}

/**
 * Gestión de preguntas frecuentes (coordinación; administración hereda por jerarquía). No hay
 * ruta que borre: una pregunta se desactiva con `isActive` (R7).
 */
@Controller('faqs')
@RequireRole(UserRole.Coordinator)
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ZodResponse({ status: 200, type: FaqAdminPageDto })
  list(@Query() query: FaqListQueryDto) {
    return this.faqs.list(query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: FaqAdminDto })
  get(@Param() { id }: IdParamDto) {
    return this.faqs.get(id);
  }

  @Post()
  @Audited({ ...AUDIT, action: 'Creó una pregunta del asistente' })
  @ZodResponse({ status: 201, type: FaqAdminDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateFaqDto) {
    return this.faqs.create(user.id, body);
  }

  @Patch(':id')
  @Audited({ ...AUDIT, action: 'Editó una pregunta del asistente' })
  @ZodResponse({ status: 200, type: FaqAdminDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateFaqDto,
  ) {
    return this.faqs.update(user.id, id, body);
  }
}

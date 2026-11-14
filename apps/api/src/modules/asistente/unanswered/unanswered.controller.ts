import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { UnansweredQuestionAuditSnapshot } from './unanswered.audit-snapshot';
import {
  UnansweredListQueryDto,
  UnansweredQuestionDto,
  UnansweredQuestionPageDto,
} from './unanswered.dto';
import { UnansweredService } from './unanswered.service';

/**
 * Preguntas sin respuesta (coordinación; administración hereda por jerarquía). Solo coordinación
 * ve quién preguntó. No hay ruta que borre: descartar cierra la pregunta y retira su texto.
 */
@Controller('unanswered-questions')
@RequireRole(UserRole.Coordinator)
export class UnansweredController {
  constructor(private readonly unanswered: UnansweredService) {}

  @Get()
  @ZodResponse({ status: 200, type: UnansweredQuestionPageDto })
  list(@Query() query: UnansweredListQueryDto) {
    return this.unanswered.list(query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: UnansweredQuestionDto })
  get(@Param() { id }: IdParamDto) {
    return this.unanswered.get(id);
  }

  // El texto de la pregunta no queda en la bitácora inmutable (R17).
  @Post(':id/discard')
  @HttpCode(200)
  @Audited({
    type: AuditLogType.Assistant,
    action: 'Descartó una pregunta sin respuesta',
    entity: 'pregunta_sin_respuesta',
    snapshot: UnansweredQuestionAuditSnapshot,
    redact: ['text', 'normalizedText'],
  })
  @ZodResponse({ status: 200, type: UnansweredQuestionDto })
  discard(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.unanswered.discard(user.id, id);
  }
}

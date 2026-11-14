import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { AssistantAnswerDto, AssistantQueryDto } from '../faqs/faqs.dto';
import { AssistantQueryService } from './assistant-query.service';

/**
 * Consulta al asistente para cualquier rol. Es POST porque puede escribir (registro de la pregunta
 * sin respuesta y bitácora). Sin `@Audited`: la fila, sin el texto escrito, la escribe el servicio.
 */
@Controller('assistant/queries')
@RequireRole(UserRole.Teacher)
export class AssistantController {
  constructor(private readonly queries: AssistantQueryService) {}

  @Post()
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AssistantAnswerDto })
  ask(@CurrentUser() user: RequestUser, @Body() body: AssistantQueryDto) {
    return this.queries.ask(user, body.question);
  }
}

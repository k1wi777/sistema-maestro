import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  ApproveFieldJournalDto,
  FieldJournalDto,
  ReturnFieldJournalDto,
} from './dto/field-journal.dto';
import { FIELD_JOURNAL_AUDIT } from './field-journal.audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/**
 * Revisión de coordinación del diario: la decisión es genérica (`ReviewsService`); estas rutas son
 * propias del diario. La coordinadora revisa los diarios de sus grados y administración, cualquiera
 * (el servicio comprueba el alcance). Coordinación nunca modifica el texto de las anotaciones.
 */
@Controller('field-journals')
@RequireRole(UserRole.Coordinator)
export class FieldJournalReviewController {
  constructor(private readonly journals: FieldJournalsService) {}

  @Post(':id/approve')
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Aprobó un diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ApproveFieldJournalDto,
  ) {
    return this.journals.approve(user, id, body);
  }

  @Post(':id/return')
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Dejó observaciones en un diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  returnJournal(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ReturnFieldJournalDto,
  ) {
    return this.journals.returnJournal(user, id, body);
  }
}

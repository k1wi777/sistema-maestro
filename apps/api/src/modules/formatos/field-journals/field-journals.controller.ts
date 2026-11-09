import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateFieldJournalDto,
  FieldJournalDto,
  FieldJournalListQueryDto,
  FieldJournalPageDto,
  VoidFieldJournalDto,
} from './dto/field-journal.dto';
import { FIELD_JOURNAL_AUDIT } from './field-journal.audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/**
 * Hojas del diario de campo (F-PA-05). El rol mínimo es docente; dueño y estado los decide el
 * servicio (un docente ve solo las suyas; coordinación, todas). Las transiciones son rutas de
 * acción, cada una con su rol y su texto de bitácora.
 */
@Controller('field-journals')
@RequireRole(UserRole.Teacher)
export class FieldJournalsController {
  constructor(private readonly journals: FieldJournalsService) {}

  @Get()
  @ZodResponse({ status: 200, type: FieldJournalPageDto })
  list(@CurrentUser() user: RequestUser, @Query() query: FieldJournalListQueryDto) {
    return this.journals.list(user, query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: FieldJournalDto })
  get(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.journals.get(user, id);
  }

  @Post()
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Creó una hoja de diario de campo' })
  @ZodResponse({ status: 201, type: FieldJournalDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateFieldJournalDto) {
    return this.journals.create(user, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Envió el diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  submit(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.journals.submit(user, id);
  }

  @Post(':id/void')
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Anuló un diario de campo', detailFromBody: 'reason' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  voidJournal(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- solo valida el motivo; la bitácora lo toma del cuerpo (`detailFromBody`)
    @Body() _body: VoidFieldJournalDto,
  ) {
    return this.journals.voidJournal(user, id);
  }
}

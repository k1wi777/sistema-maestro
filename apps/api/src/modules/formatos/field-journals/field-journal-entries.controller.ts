import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateFieldJournalEntryDto,
  FieldJournalDto,
  FieldJournalEntryParamDto,
  UpdateFieldJournalEntryDto,
} from './dto/field-journal.dto';
import { FIELD_JOURNAL_AUDIT } from './field-journal.audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/**
 * Entradas de la hoja: solo el dueño y solo en borrador u observaciones. `:id` es la hoja, así
 * que la bitácora registra la hoja completa antes y después. Toda escritura devuelve la hoja.
 */
@Controller('field-journals/:id/entries')
@RequireRole(UserRole.Teacher)
export class FieldJournalEntriesController {
  constructor(private readonly journals: FieldJournalsService) {}

  @Post()
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Agregó un registro al diario de campo' })
  @ZodResponse({ status: 201, type: FieldJournalDto })
  add(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: CreateFieldJournalEntryDto,
  ) {
    return this.journals.addEntry(user, id, body);
  }

  @Patch(':entryId')
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Editó un registro del diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id, entryId }: FieldJournalEntryParamDto,
    @Body() body: UpdateFieldJournalEntryDto,
  ) {
    return this.journals.updateEntry(user, id, entryId, body);
  }

  @Delete(':entryId')
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Quitó un registro del diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  remove(@CurrentUser() user: RequestUser, @Param() { id, entryId }: FieldJournalEntryParamDto) {
    return this.journals.removeEntry(user, id, entryId);
  }
}

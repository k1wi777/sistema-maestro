import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateObserverNoteDto,
  ObserverNoteDto,
  ObserverNoteListQueryDto,
  ObserverNotePageDto,
  UpdateObserverNoteDto,
  VoidObserverNoteDto,
} from './dto/observer-note.dto';
import { OBSERVER_NOTE_AUDIT } from './observer-note.audit-snapshot';
import { ObserverNotesService } from './observer-notes.service';

/**
 * Observador del estudiante. El rol mínimo es docente; dueño y estado los decide el servicio
 * (un docente ve solo las suyas; coordinación, todas). Las transiciones son rutas de acción.
 */
@Controller('observer-notes')
@RequireRole(UserRole.Teacher)
export class ObserverNotesController {
  constructor(private readonly notes: ObserverNotesService) {}

  @Get()
  @ZodResponse({ status: 200, type: ObserverNotePageDto })
  list(@CurrentUser() user: RequestUser, @Query() query: ObserverNoteListQueryDto) {
    return this.notes.list(user, query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  get(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.notes.get(user, id);
  }

  @Post()
  @Audited({ ...OBSERVER_NOTE_AUDIT, action: 'Registró una anotación en el observador' })
  @ZodResponse({ status: 201, type: ObserverNoteDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateObserverNoteDto) {
    return this.notes.create(user, body);
  }

  @Patch(':id')
  @Audited({ ...OBSERVER_NOTE_AUDIT, action: 'Editó una anotación del observador' })
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateObserverNoteDto,
  ) {
    return this.notes.update(user, id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Audited({ ...OBSERVER_NOTE_AUDIT, action: 'Envió una anotación del observador' })
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  submit(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.notes.submit(user, id);
  }

  @Post(':id/void')
  @HttpCode(200)
  @Audited({
    ...OBSERVER_NOTE_AUDIT,
    action: 'Anuló una anotación del observador',
    detailFromBody: 'reason',
  })
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  voidNote(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- solo valida el motivo; la bitácora lo toma del cuerpo (`detailFromBody`)
    @Body() _body: VoidObserverNoteDto,
  ) {
    return this.notes.voidNote(user, id);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  ApproveObserverNoteDto,
  ObserverNoteDto,
  ObserverNoteReviewListDto,
  ReturnObserverNoteDto,
} from './dto/observer-note.dto';
import { OBSERVER_NOTE_AUDIT } from './observer-note.audit-snapshot';
import { ObserverNotesService } from './observer-notes.service';

/**
 * Revisión de coordinación del observador: la revisión es genérica (`ReviewsService`); estas
 * rutas son propias del tipo de registro. Aprobar y devolver admiten ajustes de contenido
 * opcionales (`changes`), que se aplican en la misma operación.
 */
@Controller('observer-notes')
@RequireRole(UserRole.Coordinator)
export class ObserverNoteReviewController {
  constructor(private readonly notes: ObserverNotesService) {}

  @Post(':id/approve')
  @HttpCode(200)
  @Audited({ ...OBSERVER_NOTE_AUDIT, action: 'Aprobó una anotación del observador' })
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ApproveObserverNoteDto,
  ) {
    return this.notes.approve(user, id, body);
  }

  @Post(':id/return')
  @HttpCode(200)
  @Audited({ ...OBSERVER_NOTE_AUDIT, action: 'Dejó observaciones en una anotación del observador' })
  @ZodResponse({ status: 200, type: ObserverNoteDto })
  returnNote(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ReturnObserverNoteDto,
  ) {
    return this.notes.returnNote(user, id, body);
  }

  /** El dueño también ve su historial: el rol mínimo es docente y el servicio decide la visibilidad. */
  @Get(':id/reviews')
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: ObserverNoteReviewListDto })
  history(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.notes.history(user, id);
  }
}

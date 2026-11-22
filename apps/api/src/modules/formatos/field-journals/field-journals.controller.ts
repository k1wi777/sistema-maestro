import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ALL_ROLES, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { Roles } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  AnnotationParamDto,
  CreateAnnotationDto,
  FieldJournalDayDto,
  FieldJournalDayQueryDto,
  FieldJournalDto,
  FieldJournalListQueryDto,
  FieldJournalPageDto,
  JournalReviewScopeDto,
  TodayJournalsDto,
  UpdateAnnotationDto,
  VoidFieldJournalDto,
} from './dto/field-journal.dto';
import { FIELD_JOURNAL_AUDIT } from './field-journal.audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/**
 * Diario de campo (F-PA-05) por grupo y por día. Los roles se declaran en cada ruta; quién participa,
 * dirige el grupo o coordina el grado lo decide el servicio. Cada transición es una ruta de
 * acción con su texto de bitácora y toda escritura devuelve el diario completo. Las rutas fijas
 * (`today`, `day`, `review-scope`) van antes de `:id`.
 */
@Controller('field-journals')
export class FieldJournalsController {
  constructor(private readonly journals: FieldJournalsService) {}

  @Get('today')
  @Roles(UserRole.Teacher)
  @ZodResponse({ status: 200, type: TodayJournalsDto })
  today(@CurrentUser() user: RequestUser) {
    return this.journals.today(user);
  }

  @Get('review-scope')
  @Roles(UserRole.Coordinator, UserRole.Administrator)
  @ZodResponse({ status: 200, type: JournalReviewScopeDto })
  reviewScope(@CurrentUser() user: RequestUser) {
    return this.journals.reviewScope(user);
  }

  @Get('day')
  @Roles(UserRole.Teacher)
  @ZodResponse({ status: 200, type: FieldJournalDayDto })
  day(@CurrentUser() user: RequestUser, @Query() { groupId, date }: FieldJournalDayQueryDto) {
    return this.journals.day(user, groupId, date);
  }

  @Get()
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: FieldJournalPageDto })
  list(@CurrentUser() user: RequestUser, @Query() query: FieldJournalListQueryDto) {
    return this.journals.list(user, query);
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: FieldJournalDto })
  get(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.journals.get(user, id);
  }

  /** Crea el diario del grupo y la fecha con la primera anotación; el id sale de la respuesta. */
  @Post('annotations')
  @Roles(UserRole.Teacher)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Agregó una anotación al diario de campo' })
  @ZodResponse({ status: 201, type: FieldJournalDto })
  addAnnotation(@CurrentUser() user: RequestUser, @Body() body: CreateAnnotationDto) {
    return this.journals.addAnnotation(user, body);
  }

  @Patch(':id/annotations/:annotationId')
  @Roles(UserRole.Teacher)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Editó una anotación del diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  updateAnnotation(
    @CurrentUser() user: RequestUser,
    @Param() { id, annotationId }: AnnotationParamDto,
    @Body() body: UpdateAnnotationDto,
  ) {
    return this.journals.updateAnnotation(user, id, annotationId, body);
  }

  @Post(':id/annotations/:annotationId/ready')
  @Roles(UserRole.Teacher)
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Marcó lista una anotación del diario de campo' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  markReady(@CurrentUser() user: RequestUser, @Param() { id, annotationId }: AnnotationParamDto) {
    return this.journals.markReady(user, id, annotationId);
  }

  @Post(':id/annotations/:annotationId/draft')
  @Roles(UserRole.Teacher)
  @HttpCode(200)
  @Audited({
    ...FIELD_JOURNAL_AUDIT,
    action: 'Volvió a borrador una anotación del diario de campo',
  })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  markDraft(@CurrentUser() user: RequestUser, @Param() { id, annotationId }: AnnotationParamDto) {
    return this.journals.markDraft(user, id, annotationId);
  }

  @Post(':id/submit')
  @Roles(UserRole.Teacher)
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Envió el diario de campo a coordinación' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  submit(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.journals.submit(user, id);
  }

  @Post(':id/resubmit')
  @Roles(UserRole.Teacher)
  @HttpCode(200)
  @Audited({ ...FIELD_JOURNAL_AUDIT, action: 'Reenvió el diario de campo a coordinación' })
  @ZodResponse({ status: 200, type: FieldJournalDto })
  resubmit(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.journals.resubmit(user, id);
  }

  @Post(':id/void')
  @Roles(UserRole.Teacher)
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

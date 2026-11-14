import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  ConfirmModuleFileParamsDto,
  ModuleFileParamsDto,
  ModuleFileUploadResultDto,
  RequestModuleFileUploadDto,
  SignedUrlDto,
  TrainingModuleDto,
} from '../dto/training.dto';
import { TrainingModuleAuditSnapshot } from '../training.audit-snapshot';
import { TrainingFilesService } from './training-files.service';

const AUDIT = {
  type: AuditLogType.Training,
  entity: 'modulo_formacion',
  snapshot: TrainingModuleAuditSnapshot,
};

/**
 * Video y presentación de un módulo como archivo (coordinación). La bitácora guarda el módulo
 * antes y después con los ids de archivo, nunca URL firmadas ni claves de objeto.
 */
@Controller('training-modules/:id/files')
@RequireRole(UserRole.Coordinator)
export class TrainingModuleFilesController {
  constructor(private readonly files: TrainingFilesService) {}

  @Post()
  @Audited({ ...AUDIT, action: 'Solicitó subir un archivo a un módulo de formación' })
  @ZodResponse({ status: 201, type: ModuleFileUploadResultDto })
  requestUpload(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: RequestModuleFileUploadDto,
  ) {
    return this.files.requestUpload(user, id, body);
  }

  @Post(':fileId/confirm')
  @HttpCode(200)
  // Sin `@Audited`: el `head` al almacenamiento va fuera de toda transacción y la bitácora la
  // escribe el servicio en la transacción corta que asocia el archivo.
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  confirm(@CurrentUser() user: RequestUser, @Param() { id, fileId }: ConfirmModuleFileParamsDto) {
    return this.files.confirm(user, id, fileId);
  }

  @Delete(':purpose')
  @Audited({ ...AUDIT, action: 'Quitó un archivo de un módulo de formación' })
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  remove(@Param() { id, purpose }: ModuleFileParamsDto) {
    return this.files.remove(id, purpose);
  }

  // Lectura: no se audita. POST porque emite una URL nueva en cada llamada.
  @Post(':purpose/url')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SignedUrlDto })
  url(@Param() { id, purpose }: ModuleFileParamsDto) {
    return this.files.urlForCoordination(id, purpose);
  }
}

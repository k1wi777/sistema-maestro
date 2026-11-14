import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { CertificateListDto, CertificateListQueryDto, SignedUrlDto } from '../dto/training.dto';
import { CertificatesService } from './certificates.service';

/** Certificados de los docentes vistos por coordinación (con las mismas reglas de generación). */
@Controller('training-certificates')
@RequireRole(UserRole.Coordinator)
export class TrainingCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @ZodResponse({ status: 200, type: CertificateListDto })
  list(@Query() { teacherId }: CertificateListQueryDto) {
    return this.certificates.listFor(teacherId);
  }

  /** POST porque la primera descarga genera y guarda el PDF. */
  @Post(':id/download')
  @HttpCode(200)
  // Sin `@Audited`: generar el PDF y subirlo no puede ocurrir dentro de la transacción del
  // interceptor; el servicio escribe la bitácora en una transacción corta.
  @ZodResponse({ status: 200, type: SignedUrlDto })
  download(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.certificates.downloadAny(user, id);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { Public } from '../../identidad/auth/access.decorators';
import { CertificateCodeParamDto, CertificateVerificationDto } from '../dto/training.dto';
import { CertificatesService } from './certificates.service';

/**
 * Verificación pública de un certificado por su código (D1): sin sesión, para que un tercero
 * pueda comprobarlo. Responde solo lo que el PDF ya muestra; lo limita el límite de peticiones
 * global y el código tiene 80 bits de aleatoriedad.
 */
@Controller('certificates')
@Public()
export class CertificateVerificationController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('verify/:code')
  @ZodResponse({ status: 200, type: CertificateVerificationDto })
  verify(@Param() { code }: CertificateCodeParamDto) {
    return this.certificates.verify(code);
  }
}

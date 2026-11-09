import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { AllowWithoutConsent, RequireRole } from '../auth/access.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConsentAuditSnapshot } from './consent.audit-snapshot';
import { ConsentService } from './consent.service';
import { AcceptConsentDto, ConsentStatusDto, DataConsentDto } from './dto/consent.dto';

/** Es lo único, junto al usuario propio, que un usuario sin aviso aceptado puede usar. */
@Controller('consent')
@RequireRole(UserRole.Teacher)
@AllowWithoutConsent()
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get()
  @ZodResponse({ status: 200, type: ConsentStatusDto })
  status(@CurrentUser() user: RequestUser) {
    return this.consent.status(user.id);
  }

  @Post()
  @Audited({
    type: AuditLogType.DataConsent,
    action: 'Aceptar el aviso de datos',
    entity: 'consentimiento_datos',
    snapshot: ConsentAuditSnapshot,
  })
  @ZodResponse({ status: 201, type: DataConsentDto })
  accept(@Body() body: AcceptConsentDto, @CurrentUser() user: RequestUser) {
    return this.consent.accept(user.id, body);
  }
}

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleSatisfies } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { ConsentRequiredException } from '../consent/consent-required.exception';
import { ConsentService } from '../consent/consent.service';
import { ACCESS_KEY, ALLOW_WITHOUT_CONSENT_KEY, type AccessRule } from './access.decorators';

/**
 * Decide el acceso a cada endpoint, siempre en este orden: sin declaración (403), público
 * (permite), sin sesión (401), aviso de datos sin aceptar (403 `consentimiento_requerido`)
 * y rol insuficiente (403 `sin_permiso`). El orden vive en una sola función para que no
 * dependa del orden de registro de varios guards.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly consent: ConsentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const targets = [context.getHandler(), context.getClass()];
    const rule = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_KEY, targets);

    if (!rule) {
      // Red de seguridad: la verificación de arranque ya impide que ocurra.
      this.logger.error(
        `Endpoint sin declaración de acceso: ${context.getClass().name}.${context.getHandler().name}`,
      );
      throw new ForbiddenException();
    }
    if (rule.kind === 'public') {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!user) {
      throw new UnauthorizedException();
    }
    const allowWithoutConsent = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_WITHOUT_CONSENT_KEY,
      targets,
    );
    if (!allowWithoutConsent && !(await this.consent.hasAcceptedCurrent(user.id))) {
      throw new ConsentRequiredException();
    }
    if (!roleSatisfies(user.role, rule.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

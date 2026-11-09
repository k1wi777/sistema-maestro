import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleSatisfies, type UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { AuthService } from './auth.service';
import { REQUIRED_ROLE_KEY } from './require-role.decorator';
import { ACCESS_COOKIE, readCookie, type CookieRequest } from './session-cookies';

type GuardedRequest = CookieRequest & { user?: RequestUser };

/**
 * Guard global no bloqueante: resuelve la sesión de la cookie de acceso en cada petición
 * (así la auditoría registra usuario y rol reales en cualquier endpoint) y solo rechaza
 * cuando la ruta declara `@RequireRole`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const token = readCookie(request, ACCESS_COOKIE);
    const user = token ? await this.auth.authenticate(token) : null;
    if (user) {
      request.user = user;
    }

    const required = this.reflector.getAllAndOverride<UserRole | undefined>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!roleSatisfies(user.role, required)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

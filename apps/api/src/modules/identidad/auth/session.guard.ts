import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../../core/audit/request-user';
import { AuthService } from './auth.service';
import { ACCESS_COOKIE, readCookie, type CookieRequest } from './session-cookies';

type GuardedRequest = CookieRequest & { user?: RequestUser };

/**
 * Guard global no bloqueante: solo identifica. Resuelve la sesión de la cookie de acceso
 * en cada petición (así la auditoría registra usuario y rol reales también en endpoints
 * públicos) y nunca rechaza; la decisión de acceso es de `AccessGuard`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

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
    return true;
  }
}

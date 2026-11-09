import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RequestUser } from '../../../core/audit/request-user';

/** Usuario de la sesión (`request.user`). Solo se usa en endpoints con `@RequireRole`; `AccessGuard` ya garantiza que existe. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>();
  if (!user) {
    throw new UnauthorizedException();
  }
  return user;
});

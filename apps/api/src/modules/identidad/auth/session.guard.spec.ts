import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { AuthService } from './auth.service';
import { RequireRole } from './require-role.decorator';
import { ACCESS_COOKIE } from './session-cookies';
import { SessionGuard } from './session.guard';

class OpenController {
  list(): void {}
}

class ProtectedController {
  @RequireRole(UserRole.Coordinator)
  review(): void {}

  @RequireRole(UserRole.Teacher)
  anyRole(): void {}
}

function contextFor(
  controller: Type,
  handler: string,
  request: Record<string, unknown>,
): ExecutionContext {
  const method = (controller.prototype as Record<string, () => void>)[handler] as () => void;
  return {
    getType: () => 'http',
    getHandler: () => method,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup(identified: RequestUser | null) {
  const auth = { authenticate: jest.fn(() => Promise.resolve(identified)) };
  const guard = new SessionGuard(new Reflector(), auth as unknown as AuthService);
  return { guard, auth };
}

const user = (role: UserRole): RequestUser => ({ id: 'u-1', role, sessionId: 's-1' });

describe('SessionGuard', () => {
  it('lets a public route through without a cookie and attaches no user', async () => {
    const { guard, auth } = setup(null);
    const request: Record<string, unknown> = { cookies: {} };

    await expect(guard.canActivate(contextFor(OpenController, 'list', request))).resolves.toBe(
      true,
    );
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('does not reject a public route with an invalid token but attaches no user', async () => {
    const { guard } = setup(null);
    const request: Record<string, unknown> = { cookies: { [ACCESS_COOKIE]: 'basura' } };

    await expect(guard.canActivate(contextFor(OpenController, 'list', request))).resolves.toBe(
      true,
    );
    expect(request.user).toBeUndefined();
  });

  it('attaches the user to a public route when the session is valid (audit uses it)', async () => {
    const identified = user(UserRole.Teacher);
    const { guard } = setup(identified);
    const request: Record<string, unknown> = { cookies: { [ACCESS_COOKIE]: 'token' } };

    await guard.canActivate(contextFor(OpenController, 'list', request));

    expect(request.user).toBe(identified);
  });

  it.each([
    ['no cookie', {}],
    ['an invalid or revoked session', { [ACCESS_COOKIE]: 'token' }],
  ])('answers 401 on a protected route with %s', async (_, cookies) => {
    const { guard } = setup(null);

    await expect(
      guard.canActivate(contextFor(ProtectedController, 'review', { cookies })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('answers 403 when the role is below the required one', async () => {
    const { guard } = setup(user(UserRole.Teacher));

    await expect(
      guard.canActivate(
        contextFor(ProtectedController, 'review', { cookies: { [ACCESS_COOKIE]: 'token' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    [UserRole.Coordinator, 'review'],
    [UserRole.Administrator, 'review'],
    [UserRole.Teacher, 'anyRole'],
    [UserRole.Coordinator, 'anyRole'],
    [UserRole.Administrator, 'anyRole'],
  ])('lets %s through %s by the role hierarchy', async (role, handler) => {
    const { guard } = setup(user(role));

    await expect(
      guard.canActivate(
        contextFor(ProtectedController, handler, { cookies: { [ACCESS_COOKIE]: 'token' } }),
      ),
    ).resolves.toBe(true);
  });
});

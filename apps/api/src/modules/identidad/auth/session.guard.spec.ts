import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { AuthService } from './auth.service';
import { ACCESS_COOKIE } from './session-cookies';
import { SessionGuard } from './session.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function setup(identified: RequestUser | null) {
  const auth = { authenticate: jest.fn(() => Promise.resolve(identified)) };
  return { guard: new SessionGuard(auth as unknown as AuthService), auth };
}

describe('SessionGuard', () => {
  it('lets the request through without a cookie and attaches no user', async () => {
    const { guard, auth } = setup(null);
    const request: Record<string, unknown> = { cookies: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('never rejects: an invalid token attaches no user', async () => {
    const { guard } = setup(null);
    const request: Record<string, unknown> = { cookies: { [ACCESS_COOKIE]: 'basura' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches the user when the session is valid (audit uses it)', async () => {
    const identified: RequestUser = { id: 'u-1', role: UserRole.Teacher, sessionId: 's-1' };
    const { guard } = setup(identified);
    const request: Record<string, unknown> = { cookies: { [ACCESS_COOKIE]: 'token' } };

    await guard.canActivate(contextFor(request));

    expect(request.user).toBe(identified);
  });
});

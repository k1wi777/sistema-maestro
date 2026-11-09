import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorCode, UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import type { ConsentService } from '../consent/consent.service';
import { AllowWithoutConsent, Public, RequireRole } from './access.decorators';
import { AccessGuard } from './access.guard';

class UndeclaredController {
  list(): void {}
}

@Public()
class PublicController {
  list(): void {}
}

@RequireRole(UserRole.Administrator)
class AdminController {
  list(): void {}

  @Public()
  open(): void {}
}

class MixedController {
  @RequireRole(UserRole.Coordinator)
  review(): void {}

  @RequireRole(UserRole.Teacher)
  anyRole(): void {}

  @RequireRole(UserRole.Teacher)
  @AllowWithoutConsent()
  profile(): void {}
}

function contextFor(controller: Type, handler: string, user?: RequestUser): ExecutionContext {
  const method = (controller.prototype as Record<string, () => void>)[handler] as () => void;
  return {
    getType: () => 'http',
    getHandler: () => method,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function setup(accepted: boolean) {
  const consent = { hasAcceptedCurrent: jest.fn(() => Promise.resolve(accepted)) };
  return { guard: new AccessGuard(new Reflector(), consent as unknown as ConsentService), consent };
}

const user = (role: UserRole): RequestUser => ({ id: 'u-1', role, sessionId: 's-1' });

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ApiCodedException ? error.code : error;
  }
  return 'allowed';
}

describe('AccessGuard', () => {
  it('answers 403 without running anything on an endpoint with no declaration', async () => {
    const { guard } = setup(true);
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      guard.canActivate(contextFor(UndeclaredController, 'list', user(UserRole.Administrator))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('UndeclaredController.list'));
    logged.mockRestore();
  });

  it('lets a public endpoint through with or without session, without asking for consent', async () => {
    const { guard, consent } = setup(false);

    await expect(guard.canActivate(contextFor(PublicController, 'list'))).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(PublicController, 'list', user(UserRole.Teacher))),
    ).resolves.toBe(true);
    expect(consent.hasAcceptedCurrent).not.toHaveBeenCalled();
  });

  it('lets a method declaration override the class one', async () => {
    const { guard } = setup(false);

    await expect(guard.canActivate(contextFor(AdminController, 'open'))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor(AdminController, 'list'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('answers 401 without a session before looking at consent or role', async () => {
    const { guard, consent } = setup(false);

    await expect(guard.canActivate(contextFor(MixedController, 'review'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(consent.hasAcceptedCurrent).not.toHaveBeenCalled();
  });

  it('answers consent required before insufficient role', async () => {
    const { guard } = setup(false);

    const code = await codeOf(
      guard.canActivate(contextFor(MixedController, 'review', user(UserRole.Teacher))),
    );

    expect(code).toBe(ApiErrorCode.ConsentRequired);
  });

  it('answers 403 for an insufficient role once consent was accepted', async () => {
    const { guard } = setup(true);

    await expect(
      guard.canActivate(contextFor(MixedController, 'review', user(UserRole.Teacher))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(contextFor(AdminController, 'list', user(UserRole.Coordinator))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an endpoint marked AllowWithoutConsent through without the notice accepted', async () => {
    const { guard, consent } = setup(false);

    await expect(
      guard.canActivate(contextFor(MixedController, 'profile', user(UserRole.Teacher))),
    ).resolves.toBe(true);
    expect(consent.hasAcceptedCurrent).not.toHaveBeenCalled();
  });

  it.each([
    [UserRole.Coordinator, MixedController, 'review'],
    [UserRole.Administrator, MixedController, 'review'],
    [UserRole.Teacher, MixedController, 'anyRole'],
    [UserRole.Coordinator, MixedController, 'anyRole'],
    [UserRole.Administrator, AdminController, 'list'],
  ])('lets %s through %s.%s by the role hierarchy', async (role, controller, handler) => {
    const { guard } = setup(true);

    await expect(guard.canActivate(contextFor(controller, handler, user(role)))).resolves.toBe(
      true,
    );
  });
});

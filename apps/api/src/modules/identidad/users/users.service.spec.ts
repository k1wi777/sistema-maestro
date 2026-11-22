import { ConflictException, NotFoundException } from '@nestjs/common';
import { SessionRevocationReason, UserRole, UserStatus, type User } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { SessionsService } from '../auth/sessions.service';
import type { CredentialsService } from '../credentials/credentials.service';
import type { UserRepository } from './user.repository';
import { UserRoleChangeEffects, type UserRoleChangeEffect } from './user-role-change-effects';
import { UsersService } from './users.service';

const NOW = new Date('2026-11-21T00:00:00Z');
const actor: RequestUser = { id: 'admin-1', role: UserRole.Administrator, sessionId: 's-1' };

const person = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  fullName: 'Laura Demo',
  email: 'laura@gns.test',
  role: UserRole.Teacher,
  status: UserStatus.Active,
  createdById: null,
  createdAt: NOW,
  ...overrides,
});

function setup(stored: User | null = person(), administrators: string[] = ['admin-1', 'admin-2']) {
  const repository = {
    findById: jest.fn(() => Promise.resolve(stored)),
    findPage: jest.fn(),
    findByEmail: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(),
    update: jest.fn((_id: string, changes: Partial<User>) =>
      Promise.resolve({ ...(stored as User), ...changes }),
    ),
    lockActiveAdministrators: jest.fn(() => Promise.resolve(administrators)),
  } satisfies UserRepository;
  const sessions = { revokeAllForUser: jest.fn(() => Promise.resolve()) };
  const transactions: TransactionRunner = { run: (fn) => fn() };
  const effects = new UserRoleChangeEffects();
  const effect = { onRoleChange: jest.fn(() => Promise.resolve()) };
  effects.register(effect satisfies UserRoleChangeEffect);
  const service = new UsersService(
    repository,
    transactions,
    {} as CredentialsService,
    sessions as unknown as SessionsService,
    effects,
  );
  return { service, repository, sessions, effect };
}

describe('UsersService.changeRole', () => {
  it('cambia el rol, ejecuta los efectos con quién lo hizo y revoca las sesiones', async () => {
    const { service, repository, sessions, effect } = setup();

    const result = await service.changeRole('user-1', UserRole.Coordinator, actor);

    expect(result.role).toBe(UserRole.Coordinator);
    expect(repository.update).toHaveBeenCalledWith('user-1', { role: UserRole.Coordinator });
    expect(effect.onRoleChange).toHaveBeenCalledWith({
      userId: 'user-1',
      from: UserRole.Teacher,
      to: UserRole.Coordinator,
      actor,
    });
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      SessionRevocationReason.RoleChange,
    );
  });

  it('responde 404 si el usuario no existe', async () => {
    await expect(
      setup(null).service.changeRole('x', UserRole.Coordinator, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 409 si administración intenta cambiar su propio rol', async () => {
    const { service, repository } = setup(person({ id: 'admin-1', role: UserRole.Administrator }));

    await expect(service.changeRole('admin-1', UserRole.Teacher, actor)).rejects.toThrow(
      'No puedes cambiar tu propio rol',
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('repetir el rol actual no cambia nada: ni efectos ni sesiones', async () => {
    const { service, repository, sessions, effect } = setup();

    await service.changeRole('user-1', UserRole.Teacher, actor);

    expect(repository.update).not.toHaveBeenCalled();
    expect(effect.onRoleChange).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('responde 409 si el usuario es el último administrador activo', async () => {
    const stored = person({ id: 'admin-2', role: UserRole.Administrator });
    const { service, repository, sessions } = setup(stored, ['admin-2']);

    await expect(service.changeRole('admin-2', UserRole.Coordinator, actor)).rejects.toThrow(
      'Debe quedar al menos un administrador activo',
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('permite degradar a un administrador si queda otro activo', async () => {
    const stored = person({ id: 'admin-2', role: UserRole.Administrator });
    const { service, repository } = setup(stored, ['admin-1', 'admin-2']);

    await service.changeRole('admin-2', UserRole.Coordinator, actor);

    expect(repository.lockActiveAdministrators).toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith('admin-2', { role: UserRole.Coordinator });
  });
});

describe('UsersService.setStatus', () => {
  it('desactivar revoca las sesiones y no toca nada más', async () => {
    const { service, sessions, effect } = setup();

    await service.setStatus('user-1', UserStatus.Inactive, actor);

    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      SessionRevocationReason.Deactivation,
    );
    expect(effect.onRoleChange).not.toHaveBeenCalled();
  });

  it('responde 409 si administración intenta desactivarse', async () => {
    const { service } = setup(person({ id: 'admin-1', role: UserRole.Administrator }));

    await expect(service.setStatus('admin-1', UserStatus.Inactive, actor)).rejects.toThrow(
      'No puedes desactivarte a ti mismo',
    );
  });

  it('responde 409 al desactivar al último administrador activo', async () => {
    const stored = person({ id: 'admin-2', role: UserRole.Administrator });
    const { service, repository } = setup(stored, ['admin-2']);

    await expect(service.setStatus('admin-2', UserStatus.Inactive, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('no consulta a los administradores al desactivar a un docente ni al reactivar', async () => {
    const { service, repository } = setup(person({ status: UserStatus.Inactive }));

    await service.setStatus('user-1', UserStatus.Active, actor);

    expect(repository.lockActiveAdministrators).not.toHaveBeenCalled();
  });
});

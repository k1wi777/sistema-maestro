import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Readable } from 'node:stream';
import { UserRole, UserStatus } from '@gns/shared';
import {
  InitialAdminPasswordError,
  InitialAdminPasswordService,
} from '../../src/modules/identidad/credentials/initial-admin-password.service';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { login, randomPassword } from './support/session';

const input = (...lines: string[]) => Readable.from(lines.map((line) => `${line}\n`));

describe('contraseña inicial del administrador (R12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: InitialAdminPasswordService;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    service = app.get(InitialAdminPasswordService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Administrador como lo deja el seed: activo y sin credencial. */
  async function seededAdmin(overrides: { role?: string; status?: string } = {}) {
    const email = `${randomUUID().slice(0, 12)}@inicial.test`;
    const user = await prisma.user.create({
      data: {
        fullName: 'Administrador de prueba',
        institutionalEmail: email,
        role: overrides.role ?? UserRole.Administrator,
        status: overrides.status ?? UserStatus.Active,
      },
    });
    return { id: user.id, email };
  }

  it('asigna la contraseña leída de la entrada al administrador activo sin credencial', async () => {
    const admin = await seededAdmin();
    const password = randomPassword();

    await service.run(admin.email.toUpperCase(), input(password));

    const credential = await prisma.passwordCredential.findUniqueOrThrow({
      where: { userId: admin.id },
    });
    expect(credential.hash.startsWith('$argon2id$')).toBe(true);
    await login(app, { email: admin.email, password }).expect(200);
  });

  it('es de un solo uso: si ya tiene credencial falla sin modificarla', async () => {
    const admin = await seededAdmin();
    await service.run(admin.email, input(randomPassword()));
    const before = await prisma.passwordCredential.findUniqueOrThrow({
      where: { userId: admin.id },
    });
    const attempt = randomPassword();

    const error: unknown = await service.run(admin.email, input(attempt)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InitialAdminPasswordError);
    expect((error as Error).message).toContain('ya tiene contraseña');
    expect((error as Error).message).not.toContain(attempt);
    const after = await prisma.passwordCredential.findUniqueOrThrow({
      where: { userId: admin.id },
    });
    expect(after.hash).toBe(before.hash);
  });

  it.each([
    ['no es administrador', { role: UserRole.Teacher }],
    ['está inactivo', { status: UserStatus.Inactive }],
  ])('falla si el usuario %s', async (_, overrides) => {
    const user = await seededAdmin(overrides);

    await expect(service.run(user.email, input(randomPassword()))).rejects.toBeInstanceOf(
      InitialAdminPasswordError,
    );
    expect(await prisma.passwordCredential.count({ where: { userId: user.id } })).toBe(0);
  });

  it('falla si el correo no corresponde a ningún usuario', async () => {
    await expect(
      service.run(`nadie-${randomUUID().slice(0, 8)}@inicial.test`, input(randomPassword())),
    ).rejects.toBeInstanceOf(InitialAdminPasswordError);
  });

  it.each([['corta'], ['']])(
    'rechaza una contraseña inválida sin repetirla en el error',
    async (password) => {
      const admin = await seededAdmin();

      const error: unknown = await service
        .run(admin.email, input(password))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InitialAdminPasswordError);
      if (password) {
        expect((error as Error).message).not.toContain(password);
      }
      expect(await prisma.passwordCredential.count({ where: { userId: admin.id } })).toBe(0);
    },
  );

  it('solo lee la primera línea de la entrada', async () => {
    const admin = await seededAdmin();
    const password = randomPassword();

    await service.run(admin.email, input(password, 'otra-linea-que-se-ignora'));

    await login(app, { email: admin.email, password }).expect(200);
  });
});

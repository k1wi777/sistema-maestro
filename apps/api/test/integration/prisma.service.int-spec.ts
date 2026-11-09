import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import type { Env } from '../../src/core/config/env.validation';
import { PrismaService } from '../../src/shared/database/prisma.service';

describe('PrismaService', () => {
  it('conecta con la base temporal del contenedor y no con la local', async () => {
    const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    const prisma = app.get(PrismaService);

    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(rows[0]?.db).toBe('test');
    expect(new URL(process.env.DATABASE_URL ?? '').pathname).not.toBe('/gns');

    const disconnect = jest.spyOn(prisma, '$disconnect');
    await app.close();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falla al iniciar sin filtrar la URL ni las credenciales', async () => {
    const url = 'postgresql://usuario:secreto@127.0.0.1:1/inexistente';
    const config = { get: () => url } as unknown as ConfigService<Env, true>;
    const prisma = new PrismaService(config);

    const error = await prisma.onModuleInit().then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('No se pudo conectar con la base de datos');
    expect(message).not.toContain('secreto');
    expect(message).not.toContain('127.0.0.1');
  });
});

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../../core/config/env.validation';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Única puerta de la API a PostgreSQL. Solo los repositories la usan: los
 * servicios y controladores dependen de las interfaces de repository.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      // El pool conecta de forma perezosa: sin esta consulta un fallo de conexión
      // aparecería en la primera petición en lugar de al arrancar.
      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      // El error original puede contener la URL o las credenciales: solo se
      // conserva el tipo de error en el log y el mensaje no los incluye.
      this.logger.error(
        `Fallo de conexión (${error instanceof Error ? error.name : 'desconocido'})`,
      );
      await this.$disconnect().catch(() => undefined);
      // eslint-disable-next-line preserve-caught-error -- la causa puede contener la URL o credenciales
      throw new Error(
        'No se pudo conectar con la base de datos. Verifica que PostgreSQL esté en ejecución y que DATABASE_URL sea correcta.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

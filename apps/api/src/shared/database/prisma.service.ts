import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../../core/config/env.validation';
import { PrismaClient } from '../../generated/prisma/client';
import { transactionStorage, type TransactionClient } from './transaction-context';

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
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- la función de flecha de abajo debe capturar el proxy
    const client: TransactionClient = this;
    Object.defineProperty(this, 'db', {
      get: (): TransactionClient => transactionStorage.getStore() ?? client,
    });
  }

  /**
   * Cliente que deben usar los repositories: el de la transacción activa de la
   * petición si la hay (auditoría atómica) o el cliente normal.
   * Se declara en el constructor con una función de flecha porque el cliente de Prisma
   * es un Proxy que no pasa el receptor a los getters de la clase: un `this` normal
   * apuntaría al objeto sin los delegados de modelo.
   */
  declare readonly db: TransactionClient;

  get inTransaction(): boolean {
    return transactionStorage.getStore() !== undefined;
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

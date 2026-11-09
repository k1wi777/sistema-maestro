import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PRODUCT_NAME } from '@gns/shared';
import { AppModule } from './app.module';
import { configureApp } from './core/bootstrap/configure-app';
import type { Env } from './core/config/env.validation';

async function bootstrap(): Promise<void> {
  // abortOnError: false para que un fallo de configuración llegue al catch
  // y el proceso termine con un mensaje claro en lugar de process.abort().
  // bufferLogs: los logs de arranque esperan a que configureApp instale el logger JSON.
  const app = await NestFactory.create(AppModule, { abortOnError: false, bufferLogs: true });
  configureApp(app);
  // Para que SIGTERM/SIGINT cierren la conexión a la base (onModuleDestroy).
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`${PRODUCT_NAME} API escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Con bufferLogs, sin esto el mensaje de un fallo de arranque quedaría en el búfer.
  Logger.flush();
  const message = error instanceof Error ? error.message : String(error);
  Logger.error(message, 'Bootstrap');
  process.exitCode = 1;
});

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DestinationStream } from 'pino';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/core/bootstrap/configure-app';
import { FaqExampleModule } from '../example/faq-example.module';
import { FailureModule } from './failure.module';

export interface TestAppOptions {
  /**
   * Valores de configuración distintos a los del entorno de pruebas, solo mientras se
   * crea la aplicación (las opciones se leen al construirla). `ConfigModule` valida al
   * importar `AppModule`, así que las variables de entorno ya no se pueden cambiar.
   */
  config?: Record<string, unknown>;
  /** Incluye los endpoints que provocan fallos (por defecto sí). */
  withFailures?: boolean;
  /** Para registrar middleware antes de iniciar la aplicación. */
  /** Destino del log de acceso (por defecto stdout). */
  accessLogStream?: DestinationStream;
  beforeInit?: (app: INestApplication) => void;
}

/** Crea la aplicación como `main.ts`: AppModule + `configureApp`, más los módulos de ejemplo. */
export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const overrides = options.config ?? {};
  const original = Reflect.get(ConfigService.prototype, 'get') as (...args: unknown[]) => unknown;
  const spy = jest.spyOn(ConfigService.prototype, 'get').mockImplementation(function (
    this: ConfigService,
    key: string,
    ...rest: unknown[]
  ) {
    return key in overrides ? overrides[key] : original.call(this, key, ...rest);
  });
  try {
    const imports = [AppModule, FaqExampleModule];
    if (options.withFailures ?? true) {
      imports.push(FailureModule);
    }
    const testing = await Test.createTestingModule({ imports }).compile();
    const app = testing.createNestApplication({ bufferLogs: true });
    configureApp(app, { accessLogStream: options.accessLogStream });
    options.beforeInit?.(app);
    await app.init();
    return app;
  } finally {
    spy.mockRestore();
  }
}

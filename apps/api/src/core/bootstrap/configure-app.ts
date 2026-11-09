import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { pinoHttp, type Options as PinoHttpOptions } from 'pino-http';
import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import type { Env } from '../config/env.validation';
import { createLoggerOptions, REQUEST_ID_HEADER } from '../logging/logger.options';
import { mountOpenApi } from '../openapi/openapi';

/**
 * Configuración que Nest solo admite sobre la aplicación (no como proveedores).
 * La llaman `main.ts` y las pruebas de integración, para que prueben lo mismo que
 * corre en producción.
 */
export function configureApp(
  app: INestApplication,
  options: { accessLogStream?: DestinationStream } = {},
): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.useLogger(app.get(Logger));

  // Antes que el body parser, CORS y Swagger: así toda petición (JSON mal formado, cuerpo
  // demasiado grande, preflight, /docs) deja su línea de log y recibe `X-Request-Id`.
  const { pinoHttp: logOptions } = createLoggerOptions(
    { LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }) },
    options.accessLogStream,
  );
  const [accessLog, stream] = (Array.isArray(logOptions) ? logOptions : [logOptions]) as [
    PinoHttpOptions,
    DestinationStream | undefined,
  ];
  const accessOptions: PinoHttpOptions = stream
    ? { ...accessLog, logger: pino(accessLog as LoggerOptions, stream) }
    : accessLog;
  app.use(pinoHttp(accessOptions));

  // Primero: como middleware de Express alcanza también a las respuestas de error y a las
  // rutas inexistentes.
  app.use(helmet());

  app.enableCors({
    // Lista exacta, sin comodines: la cookie httpOnly de la sesión exige credenciales.
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  // La API no es pública para terceros: el cliente del frontend se genera en desarrollo
  // o en la CI, y no publicar el mapa completo reduce la superficie de ataque.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    mountOpenApi(app);
  }
}

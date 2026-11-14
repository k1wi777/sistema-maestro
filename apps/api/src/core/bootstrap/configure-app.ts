import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ApiErrorCode, type ApiErrorBody } from '@gns/shared';
import { Logger } from 'nestjs-pino';
import { pinoHttp, type Options as PinoHttpOptions } from 'pino-http';
import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import type { Env } from '../config/env.validation';
import { createLoggerOptions, REQUEST_ID_HEADER } from '../logging/logger.options';
import { mountOpenApi } from '../openapi/openapi';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface OriginRequest {
  method: string;
  id?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface OriginResponse {
  status(code: number): OriginResponse;
  json(body: unknown): void;
}

/**
 * Defensa adicional contra CSRF: una petición que modifica datos y trae una cabecera
 * `Origin` fuera de la lista permitida se rechaza con 403 sin ejecutarla. Sin `Origin`
 * (clientes que no son un navegador) se deja pasar: un navegador siempre la envía en las
 * peticiones de escritura entre orígenes.
 */
function rejectForeignOrigin(allowedOrigins: readonly string[]) {
  return (request: OriginRequest, response: OriginResponse, next: () => void): void => {
    const origin = request.headers.origin;
    if (!WRITE_METHODS.has(request.method) || origin === undefined) {
      next();
      return;
    }
    if (typeof origin === 'string' && allowedOrigins.includes(origin)) {
      next();
      return;
    }
    const body: ApiErrorBody = {
      statusCode: 403,
      code: ApiErrorCode.Forbidden,
      message: 'Origen no permitido',
      requestId: typeof request.id === 'string' ? request.id : '',
    };
    response.status(403).json(body);
  };
}

function noStore(
  _request: unknown,
  response: { setHeader(name: string, value: string): void },
  next: () => void,
): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}

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

  // Las respuestas llevan datos pedagógicos, nombres de pila de estudiantes y exportaciones CSV:
  // ningún navegador ni proxy debe guardarlas. Como middleware, también alcanza a los errores y a
  // las rutas inexistentes (Helmet no fija esta cabecera).
  app.use(noStore);

  // Antes de CORS y del resto: una escritura desde un origen ajeno no debe ejecutarse.
  app.use(rejectForeignOrigin(config.get('CORS_ORIGINS', { infer: true })));

  // Express 5 no interpreta las cookies: la sesión viaja en cookies httpOnly.
  app.use(cookieParser());

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

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream } from 'pino';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.validation';

const ACCESS_LOGGED = Symbol('accessLogged');

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Solo se reutiliza el id que envía el cliente si es inocuo: evita inyectar saltos de
// línea o texto arbitrario en los logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

function generateRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/**
 * Opciones del logger JSON de las peticiones. Por petición solo se registran id,
 * método, ruta (sin query string, que puede llevar nombres en los filtros), código de
 * estado y duración: nunca cuerpos, cabeceras, cookies, IP ni valores de entorno.
 */
export function createLoggerOptions(
  env: Pick<Env, 'LOG_LEVEL'>,
  stream?: DestinationStream,
): Params {
  const pinoHttp = {
    level: env.LOG_LEVEL,
    genReqId: generateRequestId,
    // `configureApp` monta un primer pino-http antes del body parser y de CORS; el que
    // instala nestjs-pino (para el contexto de los logs de la aplicación) no registra de nuevo.
    autoLogging: {
      ignore: (req: IncomingMessage & { [ACCESS_LOGGED]?: true }) => {
        if (req[ACCESS_LOGGED]) {
          return true;
        }
        req[ACCESS_LOGGED] = true;
        return false;
      },
    },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => {
      if (error || res.statusCode >= 500) {
        return 'error' as const;
      }
      return res.statusCode >= 400 ? ('warn' as const) : ('info' as const);
    },
    serializers: {
      req: (req: IncomingMessage & { id?: unknown; originalUrl?: string }) => ({
        id: req.id,
        method: req.method,
        path: (req.originalUrl ?? req.url ?? '').split('?')[0],
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    // Defensa adicional por si algún código registra a mano un objeto con secretos.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'secret',
        '*.password',
        '*.token',
        '*.secret',
      ],
      censor: '[oculto]',
    },
  };
  return { pinoHttp: stream ? [pinoHttp, stream] : pinoHttp };
}

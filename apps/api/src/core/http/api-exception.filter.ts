import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiErrorCode, type ApiErrorBody } from '@gns/shared';
import { describeDatabaseError, mapPrismaError } from '../../shared/database/prisma-error.mapper';
import { RequestValidationException } from './request-validation.exception';

interface HttpRequestLike {
  id?: unknown;
}

interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(body: unknown): void;
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): void;
}

const INTERNAL_MESSAGE = 'Ocurrió un error inesperado';

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: ApiErrorCode.Validation,
  401: ApiErrorCode.Unauthenticated,
  403: ApiErrorCode.Forbidden,
  404: ApiErrorCode.NotFound,
  409: ApiErrorCode.Conflict,
  429: ApiErrorCode.TooManyRequests,
  500: ApiErrorCode.Internal,
};

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: 'La solicitud no es válida',
  401: 'Debes iniciar sesión para continuar',
  403: 'No tienes permiso para realizar esta acción',
  404: 'No se encontró el recurso solicitado',
  405: 'Método no permitido',
  409: 'La solicitud entra en conflicto con el estado actual',
  413: 'La solicitud es demasiado grande',
  415: 'Tipo de contenido no admitido',
  429: 'Demasiadas peticiones: intenta de nuevo en unos instantes',
  500: INTERNAL_MESSAGE,
};

function messageForStatus(status: number): string {
  return MESSAGE_BY_STATUS[status] ?? 'No se pudo procesar la solicitud';
}

/**
 * Nest escribe mensajes por defecto en inglés (el nombre del estado o «Cannot GET /x»);
 * los que escribe un servicio (en español) se conservan.
 */
function authoredMessage(exception: HttpException): string | null {
  const response = exception.getResponse();
  if (typeof response !== 'object' || response === null) {
    return null;
  }
  const { message, error } = response as { message?: unknown; error?: unknown };
  if (typeof message !== 'string' || message === error || /^Cannot [A-Z]+ /.test(message)) {
    return null;
  }
  // Los errores del parser del cuerpo (JSON mal formado) llegan con texto del motor.
  return exception.getStatus() >= 500 ||
    exception.getStatus() === 400 ||
    exception.getStatus() === 413
    ? null
    : message;
}

/**
 * Los errores del parser del cuerpo (body-parser) no son `HttpException`: llevan
 * `type` `entity.*`, `charset.*` o `encoding.*` y un `status` 4xx (413 cuerpo grande, 415 charset, 400 JSON mal formado).
 * Son errores del cliente, no imprevistos.
 */
function bodyParserStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) {
    return null;
  }
  const { type, status, statusCode } = exception as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  if (typeof type !== 'string' || !/^(entity|charset|encoding)\./.test(type)) {
    return null;
  }
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' && value >= 400 && value < 500 ? value : null;
}

function stackFrames(error: unknown): string[] | undefined {
  // Solo los marcos: la primera línea es el mensaje, que puede contener valores.
  if (!(error instanceof Error) || !error.stack) {
    return undefined;
  }
  return error.stack.split('\n').filter((line) => line.trimStart().startsWith('at '));
}

/** Traduce toda excepción al cuerpo de error común (`ApiErrorBody`). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();
    const requestId = this.requestIdOf(request, response);

    const body = this.toBody(exception, requestId);
    if (body.statusCode >= 500) {
      this.logInternalError(exception, requestId);
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId: string): ApiErrorBody {
    if (exception instanceof RequestValidationException) {
      return {
        statusCode: 400,
        code: ApiErrorCode.Validation,
        message: 'Los datos enviados no son válidos',
        errors: exception.fieldErrors,
        requestId,
      };
    }

    const database = mapPrismaError(exception);
    if (database) {
      return { ...database, requestId };
    }

    if (exception instanceof ThrottlerException) {
      return {
        statusCode: 429,
        code: ApiErrorCode.TooManyRequests,
        message: messageForStatus(429),
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: CODE_BY_STATUS[statusCode] ?? ApiErrorCode.Http,
        message:
          statusCode >= 500
            ? INTERNAL_MESSAGE
            : (authoredMessage(exception) ?? messageForStatus(statusCode)),
        requestId,
      };
    }

    const parserStatus = bodyParserStatus(exception);
    if (parserStatus !== null) {
      return {
        statusCode: parserStatus,
        code: CODE_BY_STATUS[parserStatus] ?? ApiErrorCode.Http,
        message: messageForStatus(parserStatus),
        requestId,
      };
    }

    return {
      statusCode: 500,
      code: ApiErrorCode.Internal,
      message: INTERNAL_MESSAGE,
      requestId,
    };
  }

  private requestIdOf(request: HttpRequestLike, response: HttpResponseLike): string {
    if (typeof request.id === 'string') {
      return request.id;
    }
    const header = response.getHeader('x-request-id');
    if (typeof header === 'string') {
      return header;
    }
    // El error ocurrió antes del middleware de logs (p. ej. JSON mal formado en el
    // parser del cuerpo): se genera aquí para que la respuesta siga trazable.
    const generated = randomUUID();
    response.setHeader('X-Request-Id', generated);
    return generated;
  }

  private logInternalError(exception: unknown, requestId: string): void {
    // Un fallo de la bitácora envuelve al error original en `cause`.
    const database = describeDatabaseError(
      exception instanceof Error && exception.cause ? exception.cause : exception,
    );
    // Un error de Prisma trae el SQL y los valores en su mensaje: solo se registran
    // sus códigos. Para el resto se registran el nombre y los marcos de la pila.
    this.logger.error({
      msg: 'Error interno',
      requestId,
      errorName: exception instanceof Error ? exception.name : typeof exception,
      ...database,
      stack: database ? undefined : stackFrames(exception),
    });
  }
}

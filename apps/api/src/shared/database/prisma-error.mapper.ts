import { ApiErrorCode } from '@gns/shared';

export interface MappedDatabaseError {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
}

interface PrismaErrorLike {
  code: string;
  meta?: unknown;
}

function isPrismaError(error: unknown): error is PrismaErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  );
}

/** SQLSTATE original del motor cuando Prisma no lo traduce a un código propio. */
function originalSqlState(error: PrismaErrorLike): unknown {
  const meta = error.meta as { driverAdapterError?: { cause?: { originalCode?: unknown } } };
  return meta?.driverAdapterError?.cause?.originalCode;
}

const CHECK_VIOLATION = '23514';

/**
 * Traduce un error de Prisma a una respuesta HTTP sin exponer tablas, columnas,
 * restricciones, SQL ni valores. Devuelve `null` si el error no es uno de los
 * previstos (el filtro lo trata como un error interno).
 */
export function mapPrismaError(error: unknown): MappedDatabaseError | null {
  if (!isPrismaError(error)) {
    return null;
  }
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        code: ApiErrorCode.Conflict,
        message: 'Ya existe un registro con esos datos',
      };
    case 'P2003':
      return {
        statusCode: 409,
        code: ApiErrorCode.Conflict,
        message: 'El registro está relacionado con datos inexistentes o en uso',
      };
    case 'P2025':
      return {
        statusCode: 404,
        code: ApiErrorCode.NotFound,
        message: 'El registro no existe',
      };
    case 'P2039':
      return originalSqlState(error) === CHECK_VIOLATION
        ? {
            statusCode: 400,
            code: ApiErrorCode.Validation,
            message: 'Algún dato no cumple las reglas del registro',
          }
        : null;
    default:
      return null;
  }
}

/** Datos del error que sí es seguro registrar: código Prisma y SQLSTATE, sin `meta` completo. */
export function describeDatabaseError(
  error: unknown,
): { prismaCode: string; sqlState?: string } | null {
  if (!isPrismaError(error)) {
    return null;
  }
  const state = originalSqlState(error);
  return typeof state === 'string'
    ? { prismaCode: error.code, sqlState: state }
    : { prismaCode: error.code };
}

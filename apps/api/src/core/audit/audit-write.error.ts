/**
 * Falló la escritura en la bitácora. No es una `HttpException` ni un error de Prisma
 * reconocible: el filtro global responde 500 y la transacción se revierte, para no
 * dejar la acción de negocio confirmada sin su rastro.
 */
export class AuditWriteError extends Error {
  constructor(cause: unknown) {
    super('No se pudo escribir en la bitácora', { cause });
    this.name = 'AuditWriteError';
  }
}

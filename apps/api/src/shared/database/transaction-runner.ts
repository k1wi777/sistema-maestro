/**
 * Ejecuta una función dentro de una transacción de base de datos. Si ya hay una
 * abierta, la reutiliza. Los servicios e interceptores dependen de esta interfaz,
 * no de Prisma.
 */
export interface TransactionRunner {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');

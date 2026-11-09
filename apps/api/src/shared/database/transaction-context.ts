import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../generated/prisma/client';

export type TransactionClient = Prisma.TransactionClient;

/**
 * Cliente de la transacción en curso para la petición actual. Evita pasar `tx` por
 * todas las firmas: los repositories usan `PrismaService.db`, que devuelve este
 * cliente si hay transacción abierta.
 */
export const transactionStorage = new AsyncLocalStorage<TransactionClient>();

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { transactionStorage } from './transaction-context';
import type { TransactionRunner } from './transaction-runner';

@Injectable()
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    if (transactionStorage.getStore()) {
      return fn();
    }
    // Todo lo que `fn` ejecute (incluidos pipes y handlers de Nest) hereda el cliente
    // de la transacción por el contexto asíncrono.
    return this.prisma.$transaction((tx) => transactionStorage.run(tx, fn));
  }
}

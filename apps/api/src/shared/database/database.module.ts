import { Module } from '@nestjs/common';
import { PrismaTransactionRunner } from './prisma-transaction-runner';
import { PrismaService } from './prisma.service';
import { TRANSACTION_RUNNER } from './transaction-runner';

// No es global: cada módulo de dominio lo importa de forma explícita, de modo que
// se vea qué módulos tocan la base. Nest mantiene una única instancia (un pool).
@Module({
  providers: [PrismaService, { provide: TRANSACTION_RUNNER, useClass: PrismaTransactionRunner }],
  exports: [PrismaService, TRANSACTION_RUNNER],
})
export class DatabaseModule {}

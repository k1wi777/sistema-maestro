import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// No es global: cada módulo de dominio lo importa de forma explícita, de modo que
// se vea qué módulos tocan la base. Nest mantiene una única instancia (un pool).
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

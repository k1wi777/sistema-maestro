import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/shared/database/database.module';
import { FailureController } from './failure.controller';
import { BigSnapshot, SecretSnapshot } from './failure.snapshots';

// Solo para pruebas: endpoints que provocan cada tipo de fallo para comprobar el
// formato común de errores y la atomicidad de la auditoría.
@Module({
  imports: [DatabaseModule],
  controllers: [FailureController],
  providers: [SecretSnapshot, BigSnapshot],
})
export class FailureModule {}

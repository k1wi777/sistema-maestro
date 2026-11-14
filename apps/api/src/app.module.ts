import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { validateEnv } from './core/config/env.validation';
import { AssistantModule } from './modules/asistente/assistant.module';
import { StructureModule } from './modules/estructura/structure.module';
import { IdentityModule } from './modules/identidad/identity.module';
import { FormatsModule } from './modules/formatos/formats.module';
import { TrainingModule } from './modules/formacion/training.module';
import { PlanningModule } from './modules/planeacion/planning.module';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Ruta relativa al cwd, que es apps/api cuando se arranca con pnpm o Turborepo.
      envFilePath: '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
    CoreModule,
    IdentityModule,
    StructureModule,
    PlanningModule,
    FormatsModule,
    TrainingModule,
    AssistantModule,
  ],
})
export class AppModule {}

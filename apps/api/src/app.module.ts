import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './core/config/env.validation';
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
  ],
})
export class AppModule {}

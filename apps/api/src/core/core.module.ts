import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { AuditModule } from '../modules/auditoria/audit.module';
import {
  loginTracker,
  LOGIN_THROTTLER_NAME,
  skipUnlessLogin,
} from '../modules/identidad/auth/login-throttle';
import { AccessGuard } from '../modules/identidad/auth/access.guard';
import { SessionGuard } from '../modules/identidad/auth/session.guard';
import { IdentityModule } from '../modules/identidad/identity.module';
import { DatabaseModule } from '../shared/database/database.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import type { Env } from './config/env.validation';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { AppZodValidationPipe } from './http/zod-validation.pipe';
import { createLoggerOptions } from './logging/logger.options';

/**
 * Proveedores globales de la capa HTTP. Vive en un módulo importado por AppModule
 * para que las pruebas que importan AppModule tengan el mismo comportamiento que
 * producción.
 */
@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createLoggerOptions({ LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }) }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('RATE_LIMIT_WINDOW_SECONDS', { infer: true }) * 1000,
          limit: config.get('RATE_LIMIT_MAX_REQUESTS', { infer: true }),
        },
        {
          // Límite de intentos de ingreso por IP y correo; solo aplica al endpoint de ingreso.
          name: LOGIN_THROTTLER_NAME,
          ttl: config.get('LOGIN_WINDOW_SECONDS', { infer: true }) * 1000,
          limit: config.get('LOGIN_MAX_ATTEMPTS', { infer: true }),
          skipIf: skipUnlessLogin,
          getTracker: loginTracker,
        },
      ],
    }),
  ],
  providers: [
    // Corre antes que interceptores y pipes: una petición rechazada no abre transacción.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Los tres guards se registran aquí, juntos: Nest ejecuta los APP_GUARD en el orden en que
    // escanea los módulos, y repartirlos entre módulos haría depender el orden 429 -> 401 -> 403
    // del orden de importación. Primero identifica la sesión y después decide el acceso.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_PIPE, useClass: AppZodValidationPipe },
    // Exterior al interceptor de auditoría: serializa cuando la transacción ya terminó.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class CoreModule {}

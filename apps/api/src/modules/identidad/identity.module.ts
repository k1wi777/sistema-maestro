import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../core/config/env.validation';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PrismaSessionRepository } from './auth/prisma-session.repository';
import { AUTH_PROVIDERS, type AuthProvider } from './auth/providers/auth-provider';
import { PasswordAuthProvider } from './auth/providers/password-auth-provider';
import { SESSION_REPOSITORY } from './auth/session.repository';
import { SessionsService } from './auth/sessions.service';
import { CredentialsService } from './credentials/credentials.service';
import { InitialAdminPasswordService } from './credentials/initial-admin-password.service';
import { PASSWORD_CREDENTIAL_REPOSITORY } from './credentials/password-credential.repository';
import { PrismaPasswordCredentialRepository } from './credentials/prisma-password-credential.repository';
import { PrismaUserRepository } from './users/prisma-user.repository';
import { UserAuditSnapshot } from './users/user.audit-snapshot';
import { USER_REPOSITORY } from './users/user.repository';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

const SECONDS_PER_MINUTE = 60;

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }) * SECONDS_PER_MINUTE,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    SessionsService,
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    PasswordAuthProvider,
    // Para añadir un proveedor (p. ej. Google) basta con registrarlo aquí.
    {
      provide: AUTH_PROVIDERS,
      inject: [PasswordAuthProvider],
      useFactory: (password: PasswordAuthProvider): AuthProvider[] => [password],
    },
    CredentialsService,
    InitialAdminPasswordService,
    { provide: PASSWORD_CREDENTIAL_REPOSITORY, useClass: PrismaPasswordCredentialRepository },
    UsersService,
    UserAuditSnapshot,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
  // El guard de sesión (global, en CoreModule) usa AuthService; el comando de contraseña
  // inicial usa InitialAdminPasswordService.
  exports: [AuthService, UsersService, CredentialsService, InitialAdminPasswordService],
})
export class IdentityModule {}

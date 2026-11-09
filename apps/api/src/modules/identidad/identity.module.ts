import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../core/config/env.validation';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuditModule } from '../auditoria/audit.module';
import { AccessDeclarationVerifier } from './auth/access-declaration.verifier';
import { AccessGuard } from './auth/access.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SessionGuard } from './auth/session.guard';
import { PrismaSessionRepository } from './auth/prisma-session.repository';
import { AUTH_PROVIDERS, type AuthProvider } from './auth/providers/auth-provider';
import { PasswordAuthProvider } from './auth/providers/password-auth-provider';
import { SESSION_REPOSITORY } from './auth/session.repository';
import { SessionsService } from './auth/sessions.service';
import { ConsentController } from './consent/consent.controller';
import { ConsentAuditSnapshot } from './consent/consent.audit-snapshot';
import { CONSENT_REPOSITORY } from './consent/consent.repository';
import { ConsentService } from './consent/consent.service';
import { PrismaConsentRepository } from './consent/prisma-consent.repository';
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
    AuditModule,
    DiscoveryModule,
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
  controllers: [AuthController, UsersController, ConsentController],
  providers: [
    AuthService,
    SessionGuard,
    AccessGuard,
    AccessDeclarationVerifier,
    ConsentService,
    ConsentAuditSnapshot,
    { provide: CONSENT_REPOSITORY, useClass: PrismaConsentRepository },
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
  // Los guards globales (registrados en CoreModule) usan AuthService y ConsentService; el
  // comando de contraseña inicial usa InitialAdminPasswordService.
  exports: [
    AuthService,
    SessionGuard,
    AccessGuard,
    ConsentService,
    UsersService,
    CredentialsService,
    InitialAdminPasswordService,
  ],
})
export class IdentityModule {}

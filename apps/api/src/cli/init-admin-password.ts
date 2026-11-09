import 'reflect-metadata';
import { Readable } from 'node:stream';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from '../core/config/env.validation';
import {
  InitialAdminPasswordError,
  InitialAdminPasswordService,
} from '../modules/identidad/credentials/initial-admin-password.service';
import { IdentityModule } from '../modules/identidad/identity.module';
import { DatabaseModule } from '../shared/database/database.module';
import { promptHidden } from './hidden-prompt';

/** Módulo mínimo del comando: configuración, base de datos e identidad (sin capa HTTP). */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    DatabaseModule,
    IdentityModule,
  ],
})
class InitAdminPasswordModule {}

/** Con terminal se pide dos veces sin eco; sin él (CI, pruebas) se lee la entrada estándar. */
async function passwordInput(): Promise<Readable> {
  if (!process.stdin.isTTY) {
    return process.stdin;
  }
  const first = await promptHidden('Contraseña inicial del administrador: ');
  const second = await promptHidden('Repite la contraseña: ');
  if (first !== second) {
    throw new InitialAdminPasswordError('Las contraseñas no coinciden');
  }
  return Readable.from([`${first}\n`]);
}

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    throw new InitialAdminPasswordError('Falta SEED_ADMIN_EMAIL en el entorno');
  }
  const input = await passwordInput();
  const app = await NestFactory.createApplicationContext(InitAdminPasswordModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    await app.get(InitialAdminPasswordService).run(email, input);
    process.stdout.write('Contraseña inicial del administrador asignada.\n');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  // Solo mensajes del propio comando: cualquier otro error puede traer datos de conexión.
  // La validación del entorno nombra las variables inválidas, nunca sus valores.
  const safe =
    error instanceof InitialAdminPasswordError ||
    (error instanceof Error && error.message.startsWith('Configuración de entorno inválida'));
  const message =
    safe && error instanceof Error
      ? error.message
      : 'No se pudo asignar la contraseña: revisa la configuración y la conexión a la base de datos';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

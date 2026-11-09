import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { emailSchema, passwordSchema, UserRole, UserStatus } from '@gns/shared';
import { UsersService } from '../users/users.service';
import { CredentialsService } from './credentials.service';

/** Error con un mensaje en español apto para mostrar; nunca incluye la contraseña. */
export class InitialAdminPasswordError extends Error {
  override readonly name = 'InitialAdminPasswordError';
}

/**
 * Asigna la contraseña inicial al administrador de los datos iniciales, que el seed
 * crea sin credencial. Es de un solo uso: falla si el usuario ya tiene una. No escribe
 * en la bitácora (operación de despliegue, como el seed, sin actor de sesión).
 */
@Injectable()
export class InitialAdminPasswordService {
  constructor(
    private readonly users: UsersService,
    private readonly credentials: CredentialsService,
  ) {}

  /** Lee la primera línea de `input` como contraseña (el comando nunca la recibe por argumento). */
  async run(rawEmail: string, input: Readable): Promise<void> {
    const email = emailSchema.safeParse(rawEmail);
    if (!email.success) {
      throw new InitialAdminPasswordError('SEED_ADMIN_EMAIL no es un correo válido');
    }
    const password = passwordSchema.safeParse(await readFirstLine(input));
    if (!password.success) {
      throw new InitialAdminPasswordError(
        `La contraseña no es válida: ${password.error.issues[0]?.message ?? 'formato incorrecto'}`,
      );
    }

    const admin = await this.users.findByEmail(email.data);
    if (admin?.role !== UserRole.Administrator || admin.status !== UserStatus.Active) {
      throw new InitialAdminPasswordError(
        'No existe un administrador activo con el correo de SEED_ADMIN_EMAIL: ejecuta primero db:seed',
      );
    }
    if (!(await this.credentials.assignIfAbsent(admin.id, password.data))) {
      throw new InitialAdminPasswordError(
        'El administrador ya tiene contraseña: usa el cambio de contraseña de la sesión o el restablecimiento de un administrador',
      );
    }
  }
}

async function readFirstLine(input: Readable): Promise<string> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      return line;
    }
    return '';
  } finally {
    lines.close();
  }
}

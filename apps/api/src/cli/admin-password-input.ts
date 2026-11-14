import { Readable } from 'node:stream';
import { InitialAdminPasswordError } from '../modules/identidad/credentials/initial-admin-password.service';

export interface AdminPasswordEnv {
  ADMIN_INITIAL_PASSWORD?: string | undefined;
}

/**
 * Entrada de la contraseña inicial del administrador. Con `ADMIN_INITIAL_PASSWORD` (solo
 * desarrollo y pruebas; la API y el comando la rechazan en producción) se usa ese valor sin
 * preguntar ni leer `stdin`. Sin ella: con terminal se pide dos veces sin eco; sin terminal
 * (CI, pruebas) se lee la entrada estándar. La política de contraseña la aplica el servicio.
 */
export async function adminPasswordInput(
  env: AdminPasswordEnv,
  stdin: Readable & { isTTY?: boolean },
  prompt: (question: string) => Promise<string>,
): Promise<Readable> {
  if (env.ADMIN_INITIAL_PASSWORD) {
    return Readable.from([`${env.ADMIN_INITIAL_PASSWORD}\n`]);
  }
  if (!stdin.isTTY) {
    return stdin;
  }
  const first = await prompt('Contraseña inicial del administrador: ');
  const second = await prompt('Repite la contraseña: ');
  if (first !== second) {
    throw new InitialAdminPasswordError('Las contraseñas no coinciden');
  }
  return Readable.from([`${first}\n`]);
}

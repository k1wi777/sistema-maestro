import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

// Dominio y claves de los usuarios demo (apps/api/prisma/seed/demo/demo.data.ts); la suite no
// importa ese archivo para no depender del código de la API más allá del entorno efímero.
const DEMO_EMAIL_DOMAIN = 'demo.gns.test';

export interface Actor {
  key: string;
  name: string;
  email: string;
  /** Sesión guardada por el proyecto `setup`. */
  sessionFile: string;
}

const AUTH_DIR = join(__dirname, '..', '.auth');

function actor(key: string, name: string): Actor {
  return {
    key,
    name,
    email: `${key}@${DEMO_EMAIL_DOMAIN}`,
    sessionFile: join(AUTH_DIR, `${key}.json`),
  };
}

// Repartos de BE-92: cada recorrido usa actores que ningún otro toca (R12).
export const ACTORS = {
  planningTeacher: actor('sofia.marquesina', 'Sofía Marquesina'),
  planningCoordinator: actor('elena.ravassa', 'Elena Ravassa'),
  formatsTeacher: actor('andres.penaverde', 'Andrés Peñaverde'),
  formatsCoordinator: actor('tomas.aldaverde', 'Tomás Aldaverde'),
  trainingTeacher: actor('daniela.fontalba', 'Daniela Fontalba'),
  // Ingresa por la interfaz en `ingreso.spec.ts`, que guarda su sesión para `role-protection`.
  signInTeacher: actor('valeria.montenueva', 'Valeria Montenueva'),
} as const;

/** Actores que ingresa el proyecto `setup` (el de ingreso lo hace su propio archivo). */
export const SETUP_ACTORS: readonly Actor[] = [
  ACTORS.planningTeacher,
  ACTORS.planningCoordinator,
  ACTORS.formatsTeacher,
  ACTORS.formatsCoordinator,
  ACTORS.trainingTeacher,
];

/** Marcador único por ejecución para los textos que escriben los recorridos (R12). */
export function runMarker(): string {
  return `E2E-${randomBytes(4).toString('hex')}`;
}

/** Contraseña de los usuarios de prueba: la define `environment.ts` en `process.env` (R4). */
export function usersPassword(): string {
  const value = process.env.E2E_USERS_PASSWORD;
  if (!value) {
    throw new Error('Falta la contraseña de prueba: la define el arranque de la suite.');
  }
  return value;
}

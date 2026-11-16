import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { passwordSchema } from '@gns/shared';
import { assertDemoAllowed } from '../../../api/prisma/seed/demo/demo-guard.ts';
import { loadDemoData } from '../../../api/prisma/seed/demo/load-demo.ts';
import { seedInitialData } from '../../../api/prisma/seed/initial/seed-initial.ts';
import { startTestEnvironment } from '../../../api/test/integration/support/global-setup';
import { LEGAL_DOCUMENTS_VERSION } from '../../src/shared/legal/content/version';
import { API_MAIN, API_PORT, WEB_PORT } from './prerequisites';

type PgClient = Parameters<typeof loadDemoData>[0];

// `pg` no es dependencia de la web: se resuelve desde la API, como el resto del soporte de BE-92.
const apiRequire = createRequire(API_MAIN);
const { Client } = apiRequire('pg') as {
  Client: new (config: { connectionString: string }) => PgClient;
};

// Administrador ficticio de los datos iniciales; la suite no inicia sesión con él.
const ADMIN = { name: 'Administrador de prueba', email: 'administrador@e2e-web.gns.test' };

const API_URL = `http://localhost:${API_PORT}`;
const API_START_TIMEOUT_MS = 60_000;

// Variables que lee la API (`envSchema`); la API nunca recibe `process.env` completo (D2).
const API_ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'CORS_ORIGINS',
  'RATE_LIMIT_MAX_REQUESTS',
  'LOG_LEVEL',
  'JWT_ACCESS_SECRET',
  'ACCESS_TOKEN_TTL_MINUTES',
  'REFRESH_TOKEN_SECRET',
  'AUTH_COOKIE_SECURE',
  'LOGIN_MAX_ATTEMPTS',
  'LOGIN_WINDOW_SECONDS',
  'DATA_POLICY_VERSION',
  'STORAGE_ENDPOINT',
  'STORAGE_REGION',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_FORCE_PATH_STYLE',
  'STORAGE_SIGNED_URL_TTL_SECONDS',
  'STORAGE_VIEW_URL_TTL_SECONDS',
] as const;

// Lo mínimo del sistema para que Node arranque sin shell en Windows y Linux.
const SYSTEM_ENV_KEYS = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];

/** Contraseña de los usuarios de prueba: `E2E_USERS_PASSWORD` o una aleatoria por ejecución (R4). */
function resolveUsersPassword(): string {
  const value = process.env.E2E_USERS_PASSWORD ?? randomBytes(18).toString('hex');
  // El error nunca incluye el valor.
  const parsed = passwordSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `E2E_USERS_PASSWORD no cumple la política de contraseña: ${parsed.error.issues[0]?.message ?? 'formato incorrecto'}`,
    );
  }
  process.env.E2E_USERS_PASSWORD = parsed.data;
  return parsed.data;
}

/** Valores del entorno efímero que BE-92 deja a criterio de quien lo usa (D3). */
function configureEphemeralEnvironment(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
    // Con la versión de pruebas de BE-92 el aviso de la web fallaría cerrado.
    DATA_POLICY_VERSION: LEGAL_DOCUMENTS_VERSION,
    // Valores de producción: la suite respeta el limitador de ingresos (R5).
    LOGIN_MAX_ATTEMPTS: '5',
    LOGIN_WINDOW_SECONDS: '300',
    // Todo el navegador sale de 127.0.0.1: con el límite general por defecto podría chocar.
    RATE_LIMIT_MAX_REQUESTS: '1000',
    // Máximo admitido: reutilizar una sesión guardada no obliga a renovar el token.
    ACCESS_TOKEN_TTL_MINUTES: '60',
    AUTH_COOKIE_SECURE: 'false',
  });
}

async function loadData(adminUrl: string, usersPassword: string): Promise<void> {
  // Solo se carga sobre el contenedor que acaba de crear esta ejecución (R2); si no, se rechaza
  // sin mostrar la URL.
  if (adminUrl !== globalThis.__GNS_TEST_DB__?.getConnectionUri()) {
    throw new Error(
      'La base de datos de destino no es la efímera de esta ejecución. Operación rechazada.',
    );
  }
  // Si el host no fuera local, falla con el mensaje de la barrera: no se salta.
  assertDemoAllowed({ NODE_ENV: process.env.NODE_ENV, DATABASE_URL: adminUrl });

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await seedInitialData(client, ADMIN);
    await loadDemoData(client, { usersPassword });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function apiEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [...SYSTEM_ENV_KEYS, ...API_ENV_KEYS]) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  // Solo se ven los errores de la API (con `warn` saldría cada 401 y 404 esperado).
  env.LOG_LEVEL = 'error';
  return env;
}

async function waitForApi(
  child: ChildProcess,
  exited: () => number | null | undefined,
): Promise<void> {
  const deadline = Date.now() + API_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const code = exited();
    if (code !== undefined) {
      throw new Error(
        `La API terminó al arrancar (código ${String(code)}); revisa la salida [api].`,
      );
    }
    try {
      // Cualquier respuesta HTTP (401 sin sesión) indica que la API ya escucha.
      await fetch(`${API_URL}/auth/me`, { signal: AbortSignal.timeout(2000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  child.kill();
  throw new Error(`La API no respondió en ${API_START_TIMEOUT_MS / 1000} s.`);
}

/** Lanza la API compilada: `cwd` vacío (nunca lee `apps/api/.env`) y `env` por lista explícita. */
async function startApi(): Promise<() => Promise<void>> {
  const emptyDir = mkdtempSync(join(tmpdir(), 'gns-e2e-api-'));
  const child = spawn(process.execPath, ['--enable-source-maps', API_MAIN], {
    cwd: emptyDir,
    env: apiEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let exitCode: number | null | undefined;
  const exited = new Promise<void>((resolve) => {
    child.on('exit', (code) => {
      exitCode = code;
      resolve();
    });
  });
  // Con LOG_LEVEL=error no hay ruido normal: lo que salga es un problema.
  const forward = (data: Buffer): void => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      process.stderr.write(`[api] ${line}\n`);
    }
  };
  child.stdout.on('data', forward);
  child.stderr.on('data', forward);

  const stop = async (): Promise<void> => {
    if (exitCode === undefined) {
      child.kill();
    }
    // El directorio no se puede borrar mientras el proceso lo tiene como `cwd`.
    await exited;
    rmSync(emptyDir, { recursive: true, force: true });
  };
  try {
    await waitForApi(child, () => exitCode);
  } catch (error) {
    await stop();
    throw error;
  }
  return stop;
}

/**
 * `globalSetup`: entorno efímero (PostgreSQL y MinIO de Testcontainers), datos iniciales y demo,
 * y la API compilada. Devuelve el cierre, que detiene la API y los contenedores.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const usersPassword = resolveUsersPassword();
  configureEphemeralEnvironment();
  await startTestEnvironment();
  const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
  if (!adminUrl) {
    throw new Error('El entorno efímero no definió TEST_ADMIN_DATABASE_URL.');
  }

  const stopContainers = async (): Promise<void> => {
    await Promise.all([
      globalThis.__GNS_TEST_DB__?.stop(),
      globalThis.__GNS_TEST_STORAGE__?.stop(),
    ]);
    globalThis.__GNS_TEST_DB__ = undefined;
    globalThis.__GNS_TEST_STORAGE__ = undefined;
  };
  let stopApi: (() => Promise<void>) | undefined;
  try {
    await loadData(adminUrl, usersPassword);
    stopApi = await startApi();
  } catch (error) {
    await stopContainers();
    throw error;
  }
  return async () => {
    await stopApi?.();
    await stopContainers();
  };
}

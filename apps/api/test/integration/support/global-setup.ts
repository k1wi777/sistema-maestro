import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { migrateDeploy } from './migrate';

declare global {
  var __GNS_TEST_DB__: StartedPostgreSqlContainer | undefined;
}

// Usuario con el que la API se conecta en las pruebas: solo hereda los privilegios
// del rol app_gns, como en despliegue (R19).
const APP_TEST_USER = 'gns_api_test';

// Misma imagen que docker-compose.yml y la CI.
const POSTGRES_IMAGE = 'postgres:16-alpine';

async function startContainer(): Promise<StartedPostgreSqlContainer> {
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  } catch (error) {
    throw new Error(
      'Docker no está disponible: inicia Docker Desktop y vuelve a ejecutar las pruebas. ' +
        'Para correr solo las pruebas unitarias sin Docker usa `pnpm --filter @gns/api test:unit`.',
      { cause: error },
    );
  }
}

/**
 * Levanta un PostgreSQL temporal en un puerto aleatorio, aplica las migraciones con
 * el superusuario y crea el usuario de la aplicación, que hereda de `app_gns`.
 * Las variables se fijan en process.env antes de crear los workers de Jest, que las
 * heredan; Prisma y @nestjs/config no pisan variables ya definidas, así que el
 * apps/api/.env local nunca gana. `DATABASE_URL` (la que usa la API) es la del
 * usuario de la aplicación; la del superusuario queda en `TEST_ADMIN_DATABASE_URL`.
 */
export default async function globalSetup(): Promise<void> {
  const container = await startContainer();
  globalThis.__GNS_TEST_DB__ = container;

  const adminUrl = container.getConnectionUri();
  await migrateDeploy(adminUrl);

  const password = randomBytes(24).toString('hex');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE ROLE ${APP_TEST_USER} LOGIN PASSWORD '${password}' IN ROLE app_gns`);
  } finally {
    await admin.end();
  }

  const appUrl = new URL(adminUrl);
  appUrl.username = APP_TEST_USER;
  appUrl.password = password;

  process.env.TEST_ADMIN_DATABASE_URL = adminUrl;
  process.env.DATABASE_URL = appUrl.toString();
  process.env.NODE_ENV = 'test';
  process.env.PORT ??= '3000';
  process.env.CORS_ORIGINS ??= 'http://localhost:3001';
  process.env.LOG_LEVEL = 'silent';
  process.env.RATE_LIMIT_MAX_REQUESTS ??= '1000';
  // Secretos de prueba efímeros, distintos en cada ejecución; solo valen para esta suite.
  process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('hex');
  process.env.REFRESH_TOKEN_SECRET ??= randomBytes(32).toString('hex');
  process.env.AUTH_COOKIE_SECURE ??= 'false';
  // Alto para que los ingresos de las pruebas no choquen con el límite; la prueba del 429 lo baja.
  process.env.LOGIN_MAX_ATTEMPTS ??= '100';
}

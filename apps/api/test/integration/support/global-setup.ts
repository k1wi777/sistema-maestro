import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const run = promisify(execFile);

declare global {
  var __GNS_TEST_DB__: StartedPostgreSqlContainer | undefined;
}

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
 * Levanta un PostgreSQL temporal en un puerto aleatorio y aplica las migraciones.
 * Las variables se fijan en process.env antes de crear los workers de Jest, que las
 * heredan; Prisma y @nestjs/config no pisan variables ya definidas, así que el
 * apps/api/.env local nunca gana.
 */
export default async function globalSetup(): Promise<void> {
  const container = await startContainer();
  globalThis.__GNS_TEST_DB__ = container;

  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.NODE_ENV = 'test';
  process.env.PORT ??= '3000';

  // Nunca `migrate dev` ni `reset`: solo se aplican las migraciones versionadas.
  const apiRoot = join(__dirname, '..', '..', '..');
  // Se invoca la CLI con el mismo Node, sin shell (cmd en Windows).
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [apiRoot] });
  await run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: process.env,
  });
}

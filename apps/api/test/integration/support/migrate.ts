import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const API_ROOT = join(__dirname, '..', '..', '..');

/**
 * Aplica las migraciones versionadas con la CLI de Prisma (nunca `migrate dev` ni
 * `reset`). Se invoca con el mismo Node y sin shell (cmd en Windows).
 */
export async function migrateDeploy(databaseUrl: string): Promise<void> {
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [API_ROOT] });
  await run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

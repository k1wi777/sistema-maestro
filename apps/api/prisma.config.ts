import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no carga .env por sí solo. En local se lee apps/api/.env; en la CI
// DATABASE_URL llega del entorno y el archivo no existe. loadEnvFile no pisa
// las variables que ya estén definidas.
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const databaseUrl = process.env.DATABASE_URL;

const runInitial =
  'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env prisma/seed/run-initial.ts';

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
  migrations: {
    path: join('prisma', 'migrations'),
    // Datos iniciales idempotentes; los datos demo nunca se cargan por aquí.
    seed: runInitial,
  },
  // Sin DATABASE_URL (instalación, lint y build en un clon sin .env) solo se
  // necesita `prisma generate`, que no usa la base. Los comandos que sí la
  // necesitan (migrate, db:check, db:seed) fallan con el error propio de Prisma.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});

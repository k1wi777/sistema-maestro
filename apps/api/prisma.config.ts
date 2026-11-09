import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no carga .env por sí solo. En local se lee apps/api/.env; en la CI
// DATABASE_URL llega del entorno y el archivo no existe. loadEnvFile no pisa
// las variables que ya estén definidas.
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
  migrations: {
    path: join('prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

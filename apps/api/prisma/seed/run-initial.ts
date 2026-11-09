import pg from 'pg';
import { parseAdminConfig } from './initial/admin-config.ts';
import { seedInitialData, type SeedSummary } from './initial/seed-initial.ts';

function printSummary(summary: SeedSummary): void {
  console.log('Datos iniciales cargados (tabla: insertadas / ya existían):');
  for (const [table, { inserted, existing }] of Object.entries(summary)) {
    console.log(`  ${table}: ${inserted} / ${existing}`);
  }
}

async function main(): Promise<void> {
  // La configuración se valida antes de conectar: un error no toca la base.
  const admin = parseAdminConfig(process.env);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta la variable de entorno DATABASE_URL.');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const summary = await seedInitialData(client, admin);
    await client.query('COMMIT');
    printSummary(summary);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'La carga de datos iniciales falló.');
  process.exitCode = 1;
});

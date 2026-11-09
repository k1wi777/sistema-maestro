import pg from 'pg';
import { assertDemoAllowed } from './demo/demo-guard.ts';
import { loadDemoData } from './demo/load-demo.ts';

async function main(): Promise<void> {
  // La barrera va antes de abrir cualquier conexión.
  assertDemoAllowed(process.env);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const summary = await loadDemoData(client);
    await client.query('COMMIT');
    console.log('Datos demo cargados (tabla: filas):');
    for (const [table, rows] of Object.entries(summary)) {
      console.log(`  ${table}: ${rows}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'La carga de datos demo falló.');
  process.exitCode = 1;
});

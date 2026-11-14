import { passwordSchema } from '@gns/shared';
import pg from 'pg';
import { assertDemoAllowed } from './demo/demo-guard.ts';
import { loadDemoData } from './demo/load-demo.ts';

/** Valida `DEMO_USERS_PASSWORD` con la política antes de escribir; el error nunca trae el valor. */
function demoUsersPassword(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = passwordSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `DEMO_USERS_PASSWORD no cumple la política de contraseña: ${parsed.error.issues[0]?.message ?? 'formato incorrecto'}`,
    );
  }
  return parsed.data;
}

async function main(): Promise<void> {
  // La barrera va antes de abrir cualquier conexión.
  assertDemoAllowed(process.env);
  const usersPassword = demoUsersPassword(process.env.DEMO_USERS_PASSWORD);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const summary = await loadDemoData(client, { usersPassword });
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

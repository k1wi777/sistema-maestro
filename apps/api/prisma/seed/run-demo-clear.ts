import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { assertDemoAllowed } from './demo/demo-guard.ts';
import { isDemoLoaded } from './demo/load-demo.ts';
import { SCHOOL_YEAR } from './initial/catalogs.data.ts';

/**
 * La bitácora no admite UPDATE, DELETE ni TRUNCATE y sus filas retienen a los
 * usuarios demo, así que los datos demo no se pueden borrar de forma selectiva
 * sin desactivar los triggers (prohibido). En su lugar se restablece la base
 * local: se recrea y se reaplican migraciones, triggers y datos iniciales.
 */

async function inspect(connectionString: string): Promise<{ demo: boolean; plan: boolean }> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const plan = await client.query(
      `SELECT 1 FROM plan_formacion WHERE area_id IS NULL AND anio_lectivo = $1 LIMIT 1`,
      [SCHOOL_YEAR],
    );
    return { demo: await isDemoLoaded(client), plan: (plan.rowCount ?? 0) > 0 };
  } finally {
    await client.end();
  }
}

/** Los argumentos son constantes: no hay entrada externa en la línea de comandos. */
function prisma(args: string[]): void {
  const result = spawnSync(`pnpm exec prisma ${args.join(' ')}`, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `prisma ${args[0]} ${args[1] ?? ''} falló (código ${result.status ?? 'desconocido'}).`,
    );
  }
}

async function main(): Promise<void> {
  // La barrera va antes de abrir cualquier conexión.
  assertDemoAllowed(process.env);
  const connectionString = process.env.DATABASE_URL ?? '';

  if (!(await inspect(connectionString)).demo) {
    console.log('No hay datos demo cargados: la base no se modificó.');
    return;
  }

  console.warn(
    'Se restablecerá la base de datos local: se pierden los datos demo y también cualquier dato que no sea inicial.',
  );
  prisma(['migrate', 'reset', '--force']);
  prisma(['db', 'seed']);

  const after = await inspect(connectionString);
  if (after.demo || !after.plan) {
    throw new Error('Comprobación final fallida: quedan datos demo o faltan los datos iniciales.');
  }
  console.log('Datos demo eliminados: la base quedó solo con los datos iniciales.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'El borrado de datos demo falló.');
  process.exitCode = 1;
});

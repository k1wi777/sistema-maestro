import { Client } from 'pg';

// El año lectivo vigente es global (a lo sumo uno en toda la base) y los archivos de
// integración corren en paralelo contra la misma base. Quien lo cambia a su gusto
// (`teacher-assignments`) toma el candado exclusivo; quien solo necesita un año vigente
// estable (las pruebas de planeación) toma el compartido: varios a la vez, nunca con el exclusivo.
const SCHOOL_YEAR_LOCK_KEY = 5_100_001;

/** Espera larga: el candado puede estar tomado por un archivo entero de pruebas. */
export const SCHOOL_YEAR_LOCK_TIMEOUT_MS = 180_000;

/**
 * Toma el candado a nivel de sesión de PostgreSQL con una conexión propia y devuelve la
 * función que lo libera (cerrar la conexión lo libera aunque la prueba falle).
 */
export async function holdSchoolYearLock(
  mode: 'shared' | 'exclusive',
): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL });
  await client.connect();
  await client.query(
    mode === 'shared' ? 'SELECT pg_advisory_lock_shared($1)' : 'SELECT pg_advisory_lock($1)',
    [SCHOOL_YEAR_LOCK_KEY],
  );
  return () => client.end();
}

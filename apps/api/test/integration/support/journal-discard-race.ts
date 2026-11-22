import { Client } from 'pg';

const POLL_MS = 50;
const WAIT_LIMIT_MS = 10_000;

/**
 * Reproduce de forma determinista el orden «el descarte bloquea el diario → el alta lo encuentra y
 * espera → el descarte borra anotaciones y diario y confirma». Una conexión propia hace de
 * descarte (replica sus sentencias; el endpoint no se puede pausar a mitad de transacción).
 *
 * `startRequest` lanza la alta sin esperarla; se espera, con sondeo acotado, a que algún backend
 * quede bloqueado por el descarte (el alta ya ejecutó su `INSERT` sin efecto y espera el
 * `FOR UPDATE`), y solo entonces se borra y se confirma. Devuelve el resultado de la alta.
 */
export async function discardJournalDuringRequest<T>(
  journalId: string,
  startRequest: () => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL });
  await client.connect();
  let request: Promise<T> | undefined;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const pid = rows[0]!.pid;
    await client.query('SELECT id FROM diario_campo WHERE id = $1 FOR UPDATE', [journalId]);

    request = startRequest();
    // Si algo falla antes de esperarla, no debe quedar un rechazo sin atender.
    request.catch(() => undefined);

    const deadline = Date.now() + WAIT_LIMIT_MS;
    for (;;) {
      const blocked = await client.query<{ total: string }>(
        'SELECT count(*) AS total FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
        [pid],
      );
      if (Number(blocked.rows[0]!.total) > 0) {
        break;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `El alta no quedó bloqueada por el descarte en ${WAIT_LIMIT_MS} ms: no se reprodujo el orden de la carrera`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    await client.query('DELETE FROM diario_anotacion WHERE diario_id = $1', [journalId]);
    await client.query('DELETE FROM diario_campo WHERE id = $1', [journalId]);
    await client.query('COMMIT');
    return await request;
  } finally {
    // Cerrar la conexión libera cualquier bloqueo pendiente aunque la prueba falle.
    await client.end();
    if (request) {
      await request.catch(() => undefined);
    }
  }
}

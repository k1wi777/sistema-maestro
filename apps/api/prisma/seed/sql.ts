import type { Client } from 'pg';

export type Row = Record<string, unknown>;

/**
 * INSERT parametrizado de una fila. Las tablas y columnas salen siempre del
 * código de los seeds (nunca de datos externos); los valores van como parámetros.
 * Con `onConflict` devuelve `null` cuando la fila ya existía y no se insertó.
 */
export async function insertRow(
  client: Client,
  table: string,
  values: Row,
  onConflict?: string,
): Promise<Row | null> {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const conflict = onConflict ? ` ON CONFLICT ${onConflict} DO NOTHING` : '';
  const result = await client.query<Row>(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})${conflict} RETURNING *`,
    Object.values(values),
  );
  return result.rows[0] ?? null;
}

/** Como `insertRow`, pero la fila debe insertarse: devuelve su id o falla. */
export async function insertForId(client: Client, table: string, values: Row): Promise<string> {
  const row = await insertRow(client, table, values);
  if (!row) {
    throw new Error(`No se pudo insertar en ${table}`);
  }
  return String(row.id);
}

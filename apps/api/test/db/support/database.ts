import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Client, DatabaseError } from 'pg';

/**
 * Igual que prisma.config.ts: manda la variable del entorno (CI) y, si falta, se
 * lee apps/api/.env (local). Se lee el archivo en lugar de usar
 * process.loadEnvFile porque Jest da a cada prueba una copia de process.env.
 */
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const envFile = join(__dirname, '..', '..', '..', '.env');
  return existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL : undefined;
}

export interface TestDatabase {
  /** Conexión de la prueba en curso, dentro de una transacción abierta. */
  readonly client: Client;
}

/**
 * Conecta con la base migrada y envuelve cada prueba en una transacción que
 * termina en ROLLBACK. Es la única forma de no dejar filas: las de la bitácora
 * no se pueden borrar.
 */
export function useTestDatabase(): TestDatabase {
  let client: Client | undefined;
  const database: TestDatabase = {
    get client(): Client {
      if (!client) {
        throw new Error('La conexión de pruebas no está abierta');
      }
      return client;
    },
  };

  beforeAll(async () => {
    const connectionString = databaseUrl();
    if (!connectionString) {
      throw new Error(
        'Falta DATABASE_URL: las pruebas de base de datos necesitan el PostgreSQL migrado ' +
          '(docker compose up -d y pnpm --filter @gns/api db:deploy).',
      );
    }
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await database.client.query('BEGIN');
  });

  afterEach(async () => {
    await database.client.query('ROLLBACK');
  });

  return database;
}

/**
 * Ejecuta una sentencia que debe fallar con el SQLSTATE indicado. Va dentro de
 * un SAVEPOINT para que la transacción de la prueba siga utilizable.
 */
export async function expectSqlError(
  client: Client,
  sqlState: string,
  sql: string,
  params: unknown[] = [],
): Promise<DatabaseError> {
  await client.query('SAVEPOINT expected_failure');
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    if (!(error instanceof DatabaseError)) {
      throw error;
    }
    expect(error.code).toBe(sqlState);
    return error;
  }
  await client.query('RELEASE SAVEPOINT expected_failure');
  throw new Error(`Se esperaba el error ${sqlState} y la sentencia tuvo éxito: ${sql}`);
}

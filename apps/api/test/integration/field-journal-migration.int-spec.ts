import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

/**
 * Migración `collaborative_field_journal` sobre datos previos (R23, P1): se aplican todas las
 * migraciones anteriores en una base propia (efímera), se cargan diarios por docente y periodo con
 * sus entradas, revisiones y bitácora, y luego se aplica la migración nueva. No usa la base
 * compartida de las demás pruebas.
 */
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');
const TARGET = '20261119000000_collaborative_field_journal';

const migrationSql = (name: string) =>
  readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');

describe('migración del diario de campo colaborativo', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;

  const insertId = async (sql: string, params: unknown[] = []): Promise<string> => {
    const result = await client.query<{ id: string }>(`${sql} RETURNING id`, params);
    return (result.rows[0] as { id: string }).id;
  };
  const count = async (table: string): Promise<number> =>
    Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`)).rows[0]?.n);

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    const previous = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name < TARGET)
      .map((entry) => entry.name)
      .sort();
    for (const name of previous) {
      await client.query(migrationSql(name));
    }
  }, 120_000);

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  it('archiva los diarios por docente y periodo sin perder filas, revisiones ni bitácora', async () => {
    await client.query(`INSERT INTO anio_lectivo (codigo) VALUES ('2026-2027')`);
    const level = await insertId(`INSERT INTO nivel (nombre, orden) VALUES ('Primaria', 3)`);
    const grade = await insertId(
      `INSERT INTO grado (nivel_id, nombre, orden) VALUES ($1, '3°', 1)`,
      [level],
    );
    const period = await insertId(
      `INSERT INTO periodo_academico (anio_lectivo, numero) VALUES ('2026-2027', 1)`,
    );
    const teacher = await insertId(
      `INSERT INTO usuario (nombre_completo, correo_institucional, rol, estado)
       VALUES ('Docente uno', 'uno@ejemplo.test', 'docente', 'activo')`,
    );
    const coordinator = await insertId(
      `INSERT INTO usuario (nombre_completo, correo_institucional, rol, estado)
       VALUES ('Coordinadora', 'coord@ejemplo.test', 'coordinador', 'activo')`,
    );
    const journal = await insertId(
      `INSERT INTO diario_campo (docente_id, grado_id, periodo_id, estado, enviada_en)
       VALUES ($1, $2, $3, 'revisada', now())`,
      [teacher, grade, period],
    );
    const entries = [
      await insertId(
        `INSERT INTO diario_entrada (diario_id, fecha, clase, tipo_evento, estudiantes, descripcion)
         VALUES ($1, '2026-03-02', 'Matemáticas', 'grupo', 'Sofía', 'Primera entrada')`,
        [journal],
      ),
      await insertId(
        `INSERT INTO diario_entrada (diario_id, fecha, clase, tipo_evento, descripcion)
         VALUES ($1, '2026-03-03', 'Arte', 'positivo', 'Segunda entrada')`,
        [journal],
      ),
    ];
    await client.query(
      `INSERT INTO revision (tipo_registro, registro_id, revisor_id, accion, fecha)
       VALUES ('diario', $1, $2, 'aprobada', now())`,
      [journal, coordinator],
    );
    await client.query(
      `INSERT INTO bitacora (rol, tipo, accion, entidad, entidad_id)
       VALUES ('docente', 'diario', 'Envió el diario de campo', 'diario_campo', $1)`,
      [journal],
    );

    await client.query(migrationSql(TARGET));

    // El archivo conserva las mismas filas con los mismos ids.
    const archived = await client.query<{ id: string; estado: string }>(
      `SELECT id, estado FROM diario_campo_historico`,
    );
    expect(archived.rows).toEqual([{ id: journal, estado: 'revisada' }]);
    const archivedEntries = await client.query<{ id: string }>(
      `SELECT id FROM diario_entrada_historico ORDER BY fecha`,
    );
    expect(archivedEntries.rows.map((row) => row.id)).toEqual(entries);
    // Las revisiones y la bitácora no se tocan.
    expect(await count(`revision WHERE registro_id = '${journal}'`)).toBe(1);
    expect(await count(`bitacora WHERE entidad_id = '${journal}'`)).toBe(1);
    // Las tablas nuevas nacen vacías.
    for (const table of [
      'diario_campo',
      'diario_anotacion',
      'diario_envio',
      'diario_observacion',
    ]) {
      expect(await count(table)).toBe(0);
    }
  });

  it('el archivo queda de solo lectura para la aplicación y las tablas nuevas son escribibles', async () => {
    const privilege = async (table: string, action: string): Promise<boolean> =>
      (
        await client.query<{ ok: boolean }>(`SELECT has_table_privilege('app_gns', $1, $2) AS ok`, [
          table,
          action,
        ])
      ).rows[0]?.ok === true;

    for (const table of ['diario_campo_historico', 'diario_entrada_historico']) {
      expect(await privilege(table, 'SELECT')).toBe(true);
      for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
        expect([table, action, await privilege(table, action)]).toEqual([table, action, false]);
      }
    }
    for (const table of [
      'diario_campo',
      'diario_anotacion',
      'diario_envio',
      'diario_observacion',
    ]) {
      for (const action of ['SELECT', 'INSERT', 'UPDATE']) {
        expect([table, action, await privilege(table, action)]).toEqual([table, action, true]);
      }
    }
    await client.query('SET ROLE app_gns');
    try {
      await expect(
        client.query(`UPDATE diario_campo_historico SET estado = 'anulado'`),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('RESET ROLE');
    }
  });

  it('renombra las restricciones del archivo a los nombres que deriva Prisma', async () => {
    const names = async (table: string): Promise<string[]> =>
      (
        await client.query<{ conname: string }>(
          `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`,
          [table],
        )
      ).rows.map((row) => row.conname);

    expect(await names('diario_campo_historico')).toEqual([
      'diario_campo_historico_docente_id_fkey',
      'diario_campo_historico_estado_check',
      'diario_campo_historico_grado_id_fkey',
      'diario_campo_historico_periodo_id_fkey',
      'diario_campo_historico_pkey',
    ]);
    expect(await names('diario_entrada_historico')).toEqual([
      'diario_entrada_historico_diario_id_fkey',
      'diario_entrada_historico_pkey',
      'diario_entrada_historico_tipo_evento_check',
    ]);
    // Las tablas nuevas reutilizan los nombres liberados (p. ej. la llave primaria).
    expect(await names('diario_campo')).toEqual(
      expect.arrayContaining(['diario_campo_pkey', 'diario_campo_estado_check']),
    );
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

/**
 * Migración `field_journal_fpa05_annotation` sobre datos previos (R6): se aplican las migraciones
 * anteriores en una base propia (efímera), se carga un diario con anotaciones con todas las
 * columnas llenas, observación y envío, y luego se aplica la migración nueva.
 */
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');
const TARGET = '20261121000000_field_journal_fpa05_annotation';
const REMOVED = ['tipo_evento', 'estudiantes', 'acciones', 'reflexion'];

const migrationSql = (name: string) =>
  readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');

describe('migración del diario de campo al formato F-PA-05', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;

  const insertId = async (sql: string, params: unknown[] = []): Promise<string> => {
    const result = await client.query<{ id: string }>(`${sql} RETURNING id`, params);
    return (result.rows[0] as { id: string }).id;
  };
  const count = async (table: string): Promise<number> =>
    Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`)).rows[0]?.n);
  const columns = async (): Promise<string[]> =>
    (
      await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'diario_anotacion'`,
      )
    ).rows.map((row) => row.column_name);

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

  it('retira las columnas sobrantes sin perder anotaciones, observaciones, envíos ni bitácora', async () => {
    await client.query(`INSERT INTO anio_lectivo (codigo) VALUES ('2026-2027')`);
    const level = await insertId(`INSERT INTO nivel (nombre, orden) VALUES ('Primaria', 3)`);
    const grade = await insertId(
      `INSERT INTO grado (nivel_id, nombre, orden) VALUES ($1, '3°', 1)`,
      [level],
    );
    const group = await insertId(`INSERT INTO grupo (grado_id, nombre) VALUES ($1, '3° 1')`, [
      grade,
    ]);
    const area = await insertId(
      `INSERT INTO area (nombre, tipo) VALUES ('Matemáticas', 'asignatura')`,
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
      `INSERT INTO diario_campo (grupo_id, fecha, anio_lectivo, estado, creado_por, enviado_en)
       VALUES ($1, '2026-03-02', '2026-2027', 'observaciones', $2, now())`,
      [group, teacher],
    );
    const annotation = await insertId(
      `INSERT INTO diario_anotacion
         (diario_id, docente_id, area_id, tipo_evento, estudiantes, descripcion, acciones, reflexion,
          estado, lista_en, enviada)
       VALUES ($1, $2, $3, 'mejorar', 'Sofía', 'Sofía no trajo el material', 'Hablar con ella',
               'Más apoyo', 'observada', now(), true)`,
      [journal, teacher, area],
    );
    const revision = await insertId(
      `INSERT INTO revision (tipo_registro, registro_id, revisor_id, accion, fecha)
       VALUES ('diario', $1, $2, 'observaciones', now())`,
      [journal, coordinator],
    );
    await client.query(
      `INSERT INTO diario_observacion (revision_id, anotacion_id, texto) VALUES ($1, $2, 'Ajustar')`,
      [revision, annotation],
    );
    await client.query(
      `INSERT INTO diario_envio
         (diario_id, director_id, enviado_en, reenvio, aportes_listos, docentes_esperados, faltantes)
       VALUES ($1, $2, now(), false, 1, 1, '[]')`,
      [journal, teacher],
    );
    await client.query(
      `INSERT INTO bitacora (rol, tipo, accion, entidad, entidad_id)
       VALUES ('docente', 'diario', 'Envió el diario de campo', 'diario_campo', $1)`,
      [journal],
    );
    expect(await columns()).toEqual(expect.arrayContaining(REMOVED));

    await client.query(migrationSql(TARGET));

    const columnsAfter = await columns();
    for (const column of REMOVED) {
      expect(columnsAfter).not.toContain(column);
    }
    expect(columnsAfter).toEqual(expect.arrayContaining(['descripcion', 'area_id', 'lista_en']));
    const rows = await client.query<{ id: string; descripcion: string }>(
      `SELECT id, descripcion FROM diario_anotacion`,
    );
    expect(rows.rows).toEqual([{ id: annotation, descripcion: 'Sofía no trajo el material' }]);
    expect(await count('diario_observacion')).toBe(1);
    expect(await count('diario_envio')).toBe(1);
    expect(await count(`bitacora WHERE entidad_id = '${journal}'`)).toBe(1);
    const constraint = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'diario_anotacion_tipo_evento_check'`,
    );
    expect(constraint.rowCount).toBe(0);
  });
});

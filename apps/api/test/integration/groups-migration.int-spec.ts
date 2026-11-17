import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

/**
 * Migración `groups_and_area_levels` sobre datos previos: se aplican todas las migraciones
 * anteriores en una base propia (efímera), se cargan asignaciones por grado y luego se aplica
 * la migración nueva. No usa la base compartida de las demás pruebas.
 */
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');
const TARGET = '20261118000000_groups_and_area_levels';

const migrationSql = (name: string) =>
  readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');

describe('migración de grupos y relación área–nivel', () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;

  const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => {
    const result = await client.query(sql, params);
    return result.rows[0] as T;
  };

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

  it('conserva las asignaciones, deja un director por grupo y llena la relación área–nivel', async () => {
    const insertId = async (sql: string, params: unknown[]): Promise<string> =>
      (await one<{ id: string }>(`${sql} RETURNING id`, params)).id;

    await client.query(`INSERT INTO anio_lectivo (codigo) VALUES ('2026-2027')`);
    const level = await insertId(
      `INSERT INTO nivel (nombre, orden) VALUES ('Bachillerato', 4)`,
      [],
    );
    const otherLevel = await insertId(`INSERT INTO nivel (nombre, orden) VALUES ('Otro', 9)`, []);
    const gradeA = await insertId(
      `INSERT INTO grado (nivel_id, nombre, orden) VALUES ($1, '7°', 1)`,
      [level],
    );
    const gradeB = await insertId(
      `INSERT INTO grado (nivel_id, nombre, orden) VALUES ($1, '8°', 2)`,
      [level],
    );
    const unused = await insertId(
      `INSERT INTO grado (nivel_id, nombre, orden) VALUES ($1, '9°', 3)`,
      [level],
    );
    const physics = await insertId(
      `INSERT INTO area (nombre, tipo) VALUES ('Física', 'asignatura')`,
      [],
    );
    const chemistry = await insertId(
      `INSERT INTO area (nombre, tipo) VALUES ('Química', 'asignatura')`,
      [],
    );
    const custom = await insertId(
      `INSERT INTO area (nombre, tipo) VALUES ('Área propia', 'asignatura')`,
      [],
    );
    const user = async (key: string) =>
      insertId(
        `INSERT INTO usuario (nombre_completo, correo_institucional, rol, estado)
         VALUES ($1, $2, 'docente', 'activo')`,
        [`Docente ${key}`, `${key}@ejemplo.test`],
      );
    const [ana, beto, carla] = [await user('ana'), await user('beto'), await user('carla')];

    const assign = (
      teacher: string,
      grade: string,
      area: string,
      homeroom: boolean,
      status: string,
      createdAt: string,
    ) =>
      insertId(
        `INSERT INTO asignacion_docente
           (docente_id, grado_id, area_id, anio_lectivo, es_director_grupo, estado, creado_en)
         VALUES ($1, $2, $3, '2026-2027', $4, $5, $6)`,
        [teacher, grade, area, homeroom, status, createdAt],
      );
    // Ana dirigía el grado 7° con la marca en dos filas suyas; Beto tenía una retirada marcada.
    const anaOldest = await assign(ana, gradeA, physics, true, 'activa', '2026-01-01T00:00:00Z');
    const anaSecond = await assign(ana, gradeA, chemistry, true, 'activa', '2026-01-02T00:00:00Z');
    const betoRetired = await assign(
      beto,
      gradeA,
      physics,
      true,
      'retirada',
      '2026-01-03T00:00:00Z',
    );
    const carlaRow = await assign(carla, gradeB, physics, false, 'activa', '2026-01-04T00:00:00Z');
    void unused;
    void otherLevel;
    void custom;

    await client.query(migrationSql(TARGET));

    // Un grupo «<grado> 1» por cada grado con asignaciones; el grado sin asignaciones no recibe grupo.
    const groups = await client.query<{ nombre: string; activo: boolean }>(
      `SELECT nombre, activo FROM grupo ORDER BY nombre`,
    );
    expect(groups.rows).toEqual([
      { nombre: '7° 1', activo: true },
      { nombre: '8° 1', activo: true },
    ]);

    // Ninguna asignación se pierde y todas quedan en el grupo de su mismo grado.
    const rows = await client.query<{
      id: string;
      nombre_grado: string;
      nombre_grupo: string;
      es_director_grupo: boolean;
      estado: string;
    }>(
      `SELECT a.id, g.nombre AS nombre_grado, gr.nombre AS nombre_grupo, a.es_director_grupo, a.estado
       FROM asignacion_docente a JOIN grupo gr ON gr.id = a.grupo_id JOIN grado g ON g.id = gr.grado_id`,
    );
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((row) => row.nombre_grupo === `${row.nombre_grado} 1`)).toBe(true);

    // Una sola marca por grupo y año entre las activas: la de la fila más antigua; la retirada, sin marca.
    const marks = new Map(rows.rows.map((row) => [row.id, row.es_director_grupo]));
    expect(marks.get(anaOldest)).toBe(true);
    expect(marks.get(anaSecond)).toBe(false);
    expect(marks.get(betoRetired)).toBe(false);
    expect(marks.get(carlaRow)).toBe(false);
    expect(rows.rows.find((row) => row.id === betoRetired)?.estado).toBe('retirada');

    // La relación área–nivel copia la regla anterior por nombre (Física y Química son de bachillerato).
    const links = await client.query<{ nombre: string }>(
      `SELECT a.nombre FROM area_nivel an JOIN area a ON a.id = an.area_id
       WHERE an.nivel_id = $1 ORDER BY a.nombre`,
      [level],
    );
    expect(links.rows.map((row) => row.nombre)).toEqual(['Física', 'Química']);

    // Las columnas nuevas arrancan activas y sin coordinadora.
    expect(
      await one<{ activos: string }>(
        `SELECT count(*) FILTER (WHERE activo AND coordinador_id IS NULL) AS activos FROM grado`,
      ),
    ).toEqual({ activos: '3' });
    expect(
      await one<{ activas: string }>(`SELECT count(*) FILTER (WHERE activa) AS activas FROM area`),
    ).toEqual({ activas: '3' });
  });

  it('el índice parcial rechaza un segundo director activo del grupo y año, no uno retirado', async () => {
    const group = await one<{ id: string }>(`SELECT id FROM grupo WHERE nombre = '7° 1'`);
    const row = await one<{ docente_id: string; area_id: string }>(
      `SELECT docente_id, area_id FROM asignacion_docente WHERE es_director_grupo`,
    );
    const area = await one<{ id: string }>(`SELECT id FROM area WHERE nombre = 'Área propia'`);

    const insert = (homeroom: boolean, status: string) =>
      client.query(
        `INSERT INTO asignacion_docente (docente_id, grupo_id, area_id, anio_lectivo, es_director_grupo, estado)
         VALUES ($1, $2, $3, '2026-2027', $4, $5)`,
        [row.docente_id, group.id, area.id, homeroom, status],
      );

    await expect(insert(true, 'activa')).rejects.toMatchObject({ code: '23505' });
    // Una retirada marcada no cuenta para el índice.
    await expect(insert(true, 'retirada')).resolves.toBeDefined();
  });

  it('la bitácora admite el tipo «estructura» y rechaza otros', async () => {
    await client.query(
      `INSERT INTO bitacora (tipo, accion, entidad, rol) VALUES ('estructura', 'Crear grupo', 'grupo', 'coordinador')`,
    );
    await expect(
      client.query(
        `INSERT INTO bitacora (tipo, accion, entidad, rol) VALUES ('otro', 'x', 'grupo', 'coordinador')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

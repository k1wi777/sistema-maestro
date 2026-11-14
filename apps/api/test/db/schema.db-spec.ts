import { expectSqlError, useTestDatabase } from './support/database';
import {
  insertAuditLog,
  insertObserverNote,
  insertReview,
  insertRow,
  insertTeacherAssignment,
  insertUser,
} from './support/fixtures';

const db = useTestDatabase();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Tablas sin id uuid ni fechas de auditoría: favorito_actividad (llave compuesta)
// y bitacora (consecutivo y fecha_hora).
const TABLES_WITHOUT_AUDIT_DATES = ['bitacora', 'favorito_actividad'];

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

async function domainTables(): Promise<string[]> {
  const result = await db.client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

async function columnsNamed(columnName: string): Promise<ColumnInfo[]> {
  const result = await db.client.query<ColumnInfo>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = $1 AND table_name <> '_prisma_migrations'
     ORDER BY table_name`,
    [columnName],
  );
  return result.rows;
}

describe('migrated schema', () => {
  it('has the 34 domain tables plus the Prisma migrations table', async () => {
    const result = await db.client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tables = result.rows.map((row) => row.table_name);

    expect(tables).toHaveLength(35);
    expect(tables).toContain('_prisma_migrations');
    expect(await domainTables()).toHaveLength(34);
    // Decisiones del modelo: un solo rol por usuario y sin tabla de estudiantes.
    expect(tables).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^(usuario_rol|estudiante|diario_estudiante)$/),
      ]),
    );
  });

  describe('primary keys', () => {
    it('gives every uuid id a database default of gen_random_uuid()', async () => {
      const ids = await columnsNamed('id');
      const uuidIds = ids.filter((column) => column.data_type === 'uuid');

      expect(uuidIds).toHaveLength(32);
      for (const column of uuidIds) {
        expect(column.column_default).toBe('gen_random_uuid()');
      }
    });

    it('assigns a UUID when a row is inserted without id', async () => {
      const user = await insertUser(db.client);

      expect(user.id).toEqual(expect.stringMatching(UUID_PATTERN));
    });

    it('assigns an increasing sequential id to the audit log', async () => {
      const first = await insertAuditLog(db.client);
      const second = await insertAuditLog(db.client);

      expect(BigInt(String(second.id))).toBeGreaterThan(BigInt(String(first.id)));
    });

    it('rejects an explicit id in the audit log', async () => {
      await expectSqlError(
        db.client,
        '428C9',
        `INSERT INTO bitacora (id, rol, tipo, accion) VALUES (999999, 'docente', 'ingreso', 'Ingreso de prueba')`,
      );
    });
  });

  describe('defaults', () => {
    it('declares creado_en and actualizado_en as timestamptz NOT NULL DEFAULT now() in every table', async () => {
      const tables = (await domainTables()).filter(
        (table) => !TABLES_WITHOUT_AUDIT_DATES.includes(table),
      );

      for (const columnName of ['creado_en', 'actualizado_en']) {
        const columns = await columnsNamed(columnName);
        expect(columns.map((column) => column.table_name)).toEqual(tables);
        for (const column of columns) {
          expect(column).toMatchObject({
            data_type: 'timestamp with time zone',
            is_nullable: 'NO',
            column_default: 'CURRENT_TIMESTAMP',
          });
        }
      }
    });

    it('sets creado_en and actualizado_en to the current time', async () => {
      const user = await insertUser(db.client);
      const now = await db.client.query<{ now: Date }>('SELECT now()');

      expect(user.creado_en).toEqual(now.rows[0]?.now);
      expect(user.actualizado_en).toEqual(now.rows[0]?.now);
    });

    it('sets fecha_hora of the audit log to the current time', async () => {
      const entry = await insertAuditLog(db.client);
      const now = await db.client.query<{ now: Date }>('SELECT now()');

      expect(entry.fecha_hora).toEqual(now.rows[0]?.now);
    });

    it('sets required booleans to false', async () => {
      const assignment = await insertTeacherAssignment(db.client);
      const note = await insertObserverNote(db.client);
      const faq = await insertRow(db.client, 'pregunta_frecuente', {
        categoria: 'General',
        pregunta: '¿Pregunta de prueba?',
        respuesta: 'Respuesta de prueba',
      });

      expect(assignment.es_director_grupo).toBe(false);
      expect(assignment.estado).toBe('activa');
      expect(note.familia_informada).toBe(false);
      expect(faq.activa).toBe(false);
    });
  });

  describe('integrity', () => {
    it('rejects deleting a row referenced by a foreign key', async () => {
      const user = await insertUser(db.client);
      await insertRow(db.client, 'consentimiento_datos', {
        usuario_id: user.id,
        version_politica: '2026-1',
        aceptado_en: new Date(),
      });

      await expectSqlError(db.client, '23503', 'DELETE FROM usuario WHERE id = $1', [user.id]);
    });

    it('rejects a second consent for the same user and policy version', async () => {
      const user = await insertUser(db.client);
      const consent = { usuario_id: user.id, version_politica: '2026-1', aceptado_en: new Date() };
      await insertRow(db.client, 'consentimiento_datos', consent);

      await expectSqlError(
        db.client,
        '23505',
        'INSERT INTO consentimiento_datos (usuario_id, version_politica, aceptado_en) VALUES ($1, $2, $3)',
        Object.values(consent),
      );
    });

    it('accepts audit log entries without a user', async () => {
      const entry = await insertAuditLog(db.client, { usuario_id: null });

      expect(entry.usuario_id).toBeNull();
    });

    it('stores the adjusted values of a review as nullable jsonb (revision.cambios)', async () => {
      const column = await db.client.query<ColumnInfo>(
        `SELECT data_type, is_nullable FROM information_schema.columns
         WHERE table_name = 'revision' AND column_name = 'cambios'`,
      );
      const review = await insertReview(db.client);

      expect(column.rows[0]).toMatchObject({ data_type: 'jsonb', is_nullable: 'YES' });
      expect(review.cambios).toBeNull();
    });
  });
});

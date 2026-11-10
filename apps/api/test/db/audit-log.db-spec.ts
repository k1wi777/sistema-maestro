import { expectSqlError, useTestDatabase } from './support/database';
import { insertAuditLog, insertUser, type Row } from './support/fixtures';

const db = useTestDatabase();

const IMMUTABLE_MESSAGE = 'La bitácora no se puede modificar ni borrar';
const RAISE_EXCEPTION = 'P0001';
const INSUFFICIENT_PRIVILEGE = '42501';
const APP_ROLE = 'app_gns';

async function auditLogRow(id: unknown): Promise<Row | undefined> {
  const result = await db.client.query<Row>('SELECT * FROM bitacora WHERE id = $1', [id]);
  return result.rows[0];
}

async function hasPrivilege(table: string, privilege: string): Promise<boolean> {
  const result = await db.client.query<{ allowed: boolean }>(
    'SELECT has_table_privilege($1, $2, $3) AS allowed',
    [APP_ROLE, table, privilege],
  );
  return result.rows[0]?.allowed ?? false;
}

describe('immutable audit log', () => {
  let entry: Row;

  beforeEach(async () => {
    const user = await insertUser(db.client);
    entry = await insertAuditLog(db.client, { usuario_id: user.id, detalle: 'Original' });
  });

  it.each([
    ['UPDATE', `UPDATE bitacora SET detalle = 'Cambiado' WHERE id = $1`, true],
    ['DELETE', 'DELETE FROM bitacora WHERE id = $1', true],
    ['TRUNCATE', 'TRUNCATE bitacora', false],
    ['TRUNCATE CASCADE from a parent table', 'TRUNCATE usuario CASCADE', false],
  ])('rejects %s for the table owner and leaves the rows intact', async (_, sql, usesId) => {
    const error = await expectSqlError(db.client, RAISE_EXCEPTION, sql, usesId ? [entry.id] : []);

    expect(error.message).toBe(IMMUTABLE_MESSAGE);
    expect(await auditLogRow(entry.id)).toEqual(entry);
  });

  describe(`${APP_ROLE} role`, () => {
    it('can only insert and select on the audit log', async () => {
      expect(await hasPrivilege('bitacora', 'SELECT')).toBe(true);
      expect(await hasPrivilege('bitacora', 'INSERT')).toBe(true);
      for (const privilege of ['UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        expect(await hasPrivilege('bitacora', privilege)).toBe(false);
      }
    });

    it('has USAGE on the public schema so it can reach the tables', async () => {
      const result = await db.client.query<{ allowed: boolean }>(
        `SELECT has_schema_privilege($1, 'public', 'USAGE') AS allowed`,
        [APP_ROLE],
      );
      expect(result.rows[0]?.allowed).toBe(true);
    });

    it('can read and write the other 30 tables', async () => {
      const result = await db.client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           AND table_name NOT IN ('bitacora', '_prisma_migrations')`,
      );

      expect(result.rows).toHaveLength(30);
      for (const { table_name: table } of result.rows) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          expect([table, privilege, await hasPrivilege(table, privilege)]).toEqual([
            table,
            privilege,
            true,
          ]);
        }
      }
    });

    it('inserts into the audit log but cannot update it', async () => {
      await db.client.query(`SET LOCAL ROLE ${APP_ROLE}`);

      const inserted = await insertAuditLog(db.client);
      await expectSqlError(
        db.client,
        INSUFFICIENT_PRIVILEGE,
        `UPDATE bitacora SET detalle = 'Cambiado' WHERE id = $1`,
        [inserted.id],
      );

      await db.client.query('RESET ROLE');
      expect(await auditLogRow(inserted.id)).toEqual(inserted);
    });
  });
});

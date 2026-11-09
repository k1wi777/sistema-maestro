import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { migrateDeploy } from './support/migrate';

const adminUrl = (): string => process.env.TEST_ADMIN_DATABASE_URL ?? '';
const databaseUrl = (name: string, url: string): string => {
  const copy = new URL(url);
  copy.pathname = `/${name}`;
  return copy.toString();
};

function usageMigrationSql(): string {
  const migrations = join(__dirname, '..', '..', 'prisma', 'migrations');
  const folder = readdirSync(migrations).find((name) => name.endsWith('_app_role_schema_usage'));
  if (!folder) {
    throw new Error('Falta la migración app_role_schema_usage');
  }
  return readFileSync(join(migrations, folder, 'migration.sql'), 'utf8');
}

describe('USAGE del esquema para app_gns (R20)', () => {
  const dbName = 'schema_usage_test';
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl() });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
  });

  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
  });

  it('recrea el esquema como lo hace migrate reset y deja a app_gns con USAGE y lectura', async () => {
    const url = databaseUrl(dbName, adminUrl());
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      // Lo que hace `prisma migrate reset`: el esquema nuevo no concede USAGE a PUBLIC.
      await client.query('DROP SCHEMA public CASCADE');
      await client.query('CREATE SCHEMA public');
      await client.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');

      await migrateDeploy(url);

      const usage = await client.query<{ allowed: boolean }>(
        `SELECT has_schema_privilege('app_gns', 'public', 'USAGE') AS allowed`,
      );
      expect(usage.rows[0]?.allowed).toBe(true);

      const appUrl = new URL(url);
      const apiUser = new URL(process.env.DATABASE_URL ?? '');
      appUrl.username = apiUser.username;
      appUrl.password = apiUser.password;
      const app = new Client({ connectionString: appUrl.toString() });
      await app.connect();
      try {
        const rows = await app.query('SELECT count(*) FROM bitacora');
        expect(rows.rows).toHaveLength(1);
      } finally {
        await app.end();
      }

      // Aplicar de nuevo el SQL de la migración no falla ni cambia nada.
      await expect(client.query(usageMigrationSql())).resolves.toBeDefined();
      const again = await client.query<{ allowed: boolean }>(
        `SELECT has_schema_privilege('app_gns', 'public', 'USAGE') AS allowed`,
      );
      expect(again.rows[0]?.allowed).toBe(true);
    } finally {
      await client.end();
    }
  }, 90_000);
});

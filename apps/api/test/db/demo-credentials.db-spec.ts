import { DEMO_EMAIL_DOMAIN } from '../../prisma/seed/demo/demo.data.ts';
import { isDemoLoaded, loadDemoData } from '../../prisma/seed/demo/load-demo.ts';
import { PasswordHasher } from '../../src/modules/identidad/credentials/password-hasher';
import { useTestDatabase } from './support/database';

const db = useTestDatabase();

const DEMO_LIKE = `%@${DEMO_EMAIL_DOMAIN}`;
// Valor de prueba sin uso real; cumple la política (12 a 128 caracteres).
const PASSWORD = 'contrasena-demo-de-prueba-1';

interface DemoCredential {
  email: string;
  status: string;
  hash: string | null;
}

async function demoCredentials(): Promise<DemoCredential[]> {
  const result = await db.client.query<DemoCredential>(
    `SELECT u.correo_institucional AS email, u.estado AS status, c.hash
     FROM usuario u LEFT JOIN credencial_contrasena c ON c.usuario_id = u.id
     WHERE u.correo_institucional LIKE $1 ORDER BY u.correo_institucional`,
    [DEMO_LIKE],
  );
  return result.rows;
}

describe('demo users password (R21)', () => {
  it('assigns the password to every demo user, the inactive one included, and none without it', async () => {
    if (await isDemoLoaded(db.client)) {
      // Base con la demo ya cargada: se comprueba que quedó coherente (todos con credencial o
      // ninguno), sin conocer el valor. La carga con y sin contraseña se prueba con la base vacía.
      const loaded = await demoCredentials();
      const withHash = loaded.filter((row) => row.hash !== null).length;
      expect([0, loaded.length]).toContain(withHash);
      return;
    }

    const hasher = new PasswordHasher();

    await db.client.query('SAVEPOINT without_password');
    await loadDemoData(db.client);
    const without = await demoCredentials();
    expect(without.length).toBeGreaterThan(0);
    expect(without.every((row) => row.hash === null)).toBe(true);
    await db.client.query('ROLLBACK TO SAVEPOINT without_password');

    await loadDemoData(db.client, { usersPassword: PASSWORD });
    const withPassword = await demoCredentials();
    expect(withPassword.length).toBe(without.length);
    expect(withPassword.some((row) => row.status === 'inactivo')).toBe(true);
    for (const row of withPassword) {
      expect(row.hash).not.toBeNull();
      expect(await hasher.verify(PASSWORD, row.hash ?? '')).toBe(true);
      expect(await hasher.verify(`${PASSWORD}x`, row.hash ?? '')).toBe(false);
    }
    // Un hash con su propia sal por usuario.
    expect(new Set(withPassword.map((row) => row.hash)).size).toBe(withPassword.length);
  });
});

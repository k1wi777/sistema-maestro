import { randomBytes } from 'node:crypto';
import { UserRole, UserStatus } from '@gns/shared';
import { Client } from 'pg';
import { assertDemoAllowed } from '../../../prisma/seed/demo/demo-guard.ts';
import { loadDemoData } from '../../../prisma/seed/demo/load-demo.ts';
import { seedInitialData } from '../../../prisma/seed/initial/seed-initial.ts';
import { PasswordHasher } from '../../../src/modules/identidad/credentials/password-hasher';
import { startTestEnvironment } from '../../integration/support/global-setup';

// Administrador ficticio de los datos iniciales; el dominio `.test` no es enrutable.
const ADMIN = { name: 'Administrador de prueba', email: 'administrador@e2e.gns.test' };

/**
 * Entorno de las pruebas de punta a punta: el efímero de integración (PostgreSQL + MinIO de
 * Testcontainers) con los datos iniciales y los demo ya cargados, como los dejaría
 * `db:seed` + `db:demo:load` en el entorno local. Con el superusuario hace solo tres cosas:
 * cargar los datos iniciales, cargar los demo (tras la barrera, que nunca se salta) y asignar la
 * contraseña inicial del administrador, la única escritura directa de la suite (R2), con el
 * mismo efecto que `admin:init-password`. La contraseña es aleatoria por ejecución y vive solo
 * en `process.env`.
 */
export default async function globalSetup(): Promise<void> {
  await startTestEnvironment();
  const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
  if (!adminUrl) {
    throw new Error('El entorno efímero no definió TEST_ADMIN_DATABASE_URL.');
  }

  // Si el host no fuera local, falla con el mensaje de la barrera: no se salta.
  assertDemoAllowed({ NODE_ENV: process.env.NODE_ENV, DATABASE_URL: adminUrl });

  const password = randomBytes(18).toString('hex');
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await seedInitialData(client, ADMIN);
    await loadDemoData(client);
    const hash = await new PasswordHasher().hash(password);
    const admin = await client.query<{ id: string }>(
      'SELECT id FROM usuario WHERE correo_institucional = $1 AND rol = $2 AND estado = $3',
      [ADMIN.email, UserRole.Administrator, UserStatus.Active],
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) {
      throw new Error('Los datos iniciales no crearon al administrador.');
    }
    await client.query('INSERT INTO credencial_contrasena (usuario_id, hash) VALUES ($1, $2)', [
      adminId,
      hash,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  process.env.E2E_ADMIN_EMAIL = ADMIN.email;
  process.env.E2E_ADMIN_PASSWORD = password;
}

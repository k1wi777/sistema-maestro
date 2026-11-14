import { randomBytes } from 'node:crypto';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { migrateDeploy } from './migrate';

declare global {
  var __GNS_TEST_DB__: StartedPostgreSqlContainer | undefined;
  var __GNS_TEST_STORAGE__: StartedTestContainer | undefined;
}

// Usuario con el que la API se conecta en las pruebas: solo hereda los privilegios
// del rol app_gns, como en despliegue (R19).
const APP_TEST_USER = 'gns_api_test';

// Misma imagen que docker-compose.yml y la CI.
const POSTGRES_IMAGE = 'postgres:16-alpine';

// Misma imagen y digest que docker-compose.yml (MinIO RELEASE.2026-10-23T20-06-51Z). Para
// actualizarla, cambia el digest en los dos archivos.
const MINIO_IMAGE =
  'cgr.dev/chainguard/minio@sha256:a1ac4589a5f8136b616e667b48a0bea9719bb10bd45799ea946f24bbedfafde4';
const MINIO_USER = 'gns-test-minio';
const MINIO_BUCKET = 'gns-test-files';

async function startContainer(): Promise<StartedPostgreSqlContainer> {
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  } catch (error) {
    throw new Error(
      'Docker no está disponible: inicia Docker Desktop y vuelve a ejecutar las pruebas. ' +
        'Para correr solo las pruebas unitarias sin Docker usa `pnpm --filter @gns/api test:unit`.',
      { cause: error },
    );
  }
}

async function createBucket(endpoint: string, password: string): Promise<void> {
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_USER, secretAccessKey: password },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  try {
    await client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
  } finally {
    client.destroy();
  }
}

async function startStorage(password: string): Promise<StartedTestContainer> {
  try {
    return await new GenericContainer(MINIO_IMAGE)
      .withCommand(['server', '/data'])
      .withEnvironment({ MINIO_ROOT_USER: MINIO_USER, MINIO_ROOT_PASSWORD: password })
      // MinIO falla al renombrar archivos sobre overlayfs: /data va en memoria.
      .withTmpFs({ '/data': 'rw' })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000).forStatusCode(200))
      .start();
  } catch (error) {
    throw new Error('No se pudo iniciar MinIO para las pruebas de almacenamiento.', {
      cause: error,
    });
  }
}

/**
 * Entorno efímero compartido por las pruebas de integración y las de punta a punta (un solo
 * sitio con las imágenes y sus digests). Levanta un PostgreSQL temporal en un puerto aleatorio, aplica las migraciones con
 * el superusuario y crea el usuario de la aplicación, que hereda de `app_gns`.
 * Las variables se fijan en process.env antes de crear los workers de Jest, que las
 * heredan; Prisma y @nestjs/config no pisan variables ya definidas, así que el
 * apps/api/.env local nunca gana. `DATABASE_URL` (la que usa la API) es la del
 * usuario de la aplicación; la del superusuario queda en `TEST_ADMIN_DATABASE_URL`.
 */
export async function startTestEnvironment(): Promise<void> {
  const storagePassword = randomBytes(16).toString('hex');
  // PostgreSQL y MinIO arrancan en paralelo.
  const [container, storage] = await Promise.all([startContainer(), startStorage(storagePassword)]);
  globalThis.__GNS_TEST_DB__ = container;
  globalThis.__GNS_TEST_STORAGE__ = storage;
  const storageEndpoint = `http://${storage.getHost()}:${storage.getMappedPort(9000)}`;
  await createBucket(storageEndpoint, storagePassword);

  const adminUrl = container.getConnectionUri();
  await migrateDeploy(adminUrl);

  const password = randomBytes(24).toString('hex');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE ROLE ${APP_TEST_USER} LOGIN PASSWORD '${password}' IN ROLE app_gns`);
  } finally {
    await admin.end();
  }

  const appUrl = new URL(adminUrl);
  appUrl.username = APP_TEST_USER;
  appUrl.password = password;

  process.env.TEST_ADMIN_DATABASE_URL = adminUrl;
  process.env.DATABASE_URL = appUrl.toString();
  process.env.NODE_ENV = 'test';
  process.env.PORT ??= '3000';
  process.env.CORS_ORIGINS ??= 'http://localhost:3001';
  process.env.LOG_LEVEL = 'silent';
  process.env.RATE_LIMIT_MAX_REQUESTS ??= '1000';
  // Secretos de prueba efímeros, distintos en cada ejecución; solo valen para esta suite.
  process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('hex');
  process.env.REFRESH_TOKEN_SECRET ??= randomBytes(32).toString('hex');
  process.env.AUTH_COOKIE_SECURE ??= 'false';
  process.env.DATA_POLICY_VERSION ??= 'prueba-1';
  // Alto para que los ingresos de las pruebas no choquen con el límite; la prueba del 429 lo baja.
  process.env.LOGIN_MAX_ATTEMPTS ??= '100';
  // Almacenamiento: el MinIO efímero de arriba (sus credenciales no salen de esta ejecución).
  process.env.STORAGE_ENDPOINT = storageEndpoint;
  process.env.STORAGE_REGION = 'us-east-1';
  process.env.STORAGE_BUCKET = MINIO_BUCKET;
  process.env.STORAGE_ACCESS_KEY_ID = MINIO_USER;
  process.env.STORAGE_SECRET_ACCESS_KEY = storagePassword;
  process.env.STORAGE_FORCE_PATH_STYLE = 'true';
  process.env.STORAGE_SIGNED_URL_TTL_SECONDS = '300';
  process.env.STORAGE_VIEW_URL_TTL_SECONDS = '7200';
}

export default async function globalSetup(): Promise<void> {
  await startTestEnvironment();
}

import { defineConfig, devices } from '@playwright/test';
import { assertPrerequisites, WEB_PORT } from './e2e/support/prerequisites';

// Los procesos de prueba (workers) también leen esta configuración: los requisitos se comprueban
// solo en el proceso principal, antes de arrancar la web (R6).
if (process.env.TEST_WORKER_INDEX === undefined) {
  assertPrerequisites();
}

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  // La base es compartida y los recorridos son secuenciales (devolución y aprobación).
  fullyParallel: false,
  workers: 1,
  // Reintentar un paso de un recorrido ya avanzado falla por estado y oculta el error real.
  retries: 0,
  forbidOnly: isCi,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/support/environment.ts',
  // La web compilada no depende de la base: la URL de la API va incrustada en la compilación.
  // La API la lanza `globalSetup`, que necesita primero la URL de la base efímera.
  webServer: {
    command: 'pnpm start',
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'lesson-planning',
      testMatch: /lesson-planning\.spec\.ts/,
      dependencies: ['setup'],
    },
    { name: 'formats', testMatch: /formats\.spec\.ts/, dependencies: ['setup'] },
    { name: 'training', testMatch: /training\.spec\.ts/, dependencies: ['setup'] },
    { name: 'ingreso', testMatch: /ingreso\.spec\.ts/ },
    { name: 'role', testMatch: /role-protection\.spec\.ts/, dependencies: ['ingreso'] },
  ],
});

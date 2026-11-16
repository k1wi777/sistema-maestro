import { expect, test } from '@playwright/test';
import { ACTORS } from './support/actors';

test.describe('Protección por rol', () => {
  test('un docente no ve contenido de coordinación', async ({ browser }) => {
    // Sesión que guardó `ingreso.spec.ts` (el proyecto `role` depende del de ingreso).
    const context = await browser.newContext({ storageState: ACTORS.signInTeacher.sessionFile });
    try {
      const page = await context.newPage();
      await page.goto('/coordinacion/planeaciones');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Esta sección no está disponible para tu rol',
      );
      await expect(page.getByText('No tienes acceso a esta sección')).toBeVisible();
      // Ni el encabezado, ni la bandeja, ni el menú de coordinación.
      await expect(page.getByRole('heading', { name: 'Planeaciones' })).toHaveCount(0);
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Coordinación académica' })).toHaveCount(0);

      await page.getByRole('link', { name: 'Ir a mi vista' }).click();
      await expect(page).toHaveURL(/\/docente/);
    } finally {
      await context.close();
    }
  });

  test('sin sesión, una ruta protegida lleva a /ingreso', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const path of ['/docente', '/coordinacion/formatos']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/ingreso\?volver=/);
        await expect(page.getByLabel('Correo institucional')).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});

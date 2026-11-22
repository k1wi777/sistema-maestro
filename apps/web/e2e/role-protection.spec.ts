import { expect, test } from '@playwright/test';
import { ACTORS } from './support/actors';

test.describe('Protección por rol', () => {
  test('un docente no ve contenido de coordinación', async ({ browser }) => {
    // Sesión que guardó `ingreso.spec.ts` (el proyecto `role` depende del de ingreso).
    const context = await browser.newContext({ storageState: ACTORS.signInTeacher.sessionFile });
    try {
      const page = await context.newPage();
      // La ruta nueva y la antigua (que se redirige a la nueva) dan el mismo aviso de rol.
      for (const path of ['/coordinacion/formatos/planeaciones', '/coordinacion/planeaciones']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          'Esta sección no está disponible para tu rol',
        );
      }
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

  test('coordinación abre la bitácora de administración: aviso de acceso, sin equivalente', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: ACTORS.consultCoordinator.sessionFile,
    });
    try {
      const page = await context.newPage();
      for (const path of ['/administracion/bitacora', '/administracion/grados-y-areas']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          'Esta sección no está disponible para tu rol',
        );
        await expect(page).toHaveURL(new RegExp(`${path}$`));
      }
      // Las rutas antiguas de coordinación se redirigen a administración y dan el mismo aviso.
      await page.goto('/coordinacion/bitacora');
      await expect(page).toHaveURL(/\/administracion\/bitacora$/);
      await expect(page.getByText('No tienes acceso a esta sección')).toBeVisible();
      await page.getByRole('link', { name: 'Ir a mi vista' }).click();
      await expect(page).toHaveURL(/\/coordinacion/);
    } finally {
      await context.close();
    }
  });

  test('administración abre una ruta de coordinación y llega a la equivalente', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ACTORS.consultAdmin.sessionFile });
    try {
      const page = await context.newPage();
      await page.goto('/coordinacion/formatos');
      await expect(page).toHaveURL(/\/administracion\/formatos$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Formatos' })).toBeVisible();
      // Un docente tampoco es de su vista: sin equivalente, aviso.
      await page.goto('/docente/formatos');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Esta sección no está disponible para tu rol',
      );
      // No hay «Cambiar de vista»: cada rol tiene una sola.
      await expect(page.getByRole('link', { name: 'Cambiar de vista' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('sin sesión, una ruta protegida lleva a /ingreso', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const path of ['/docente', '/coordinacion/formatos', '/administracion/bitacora']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/ingreso\?volver=/);
        await expect(page.getByLabel('Correo institucional')).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});

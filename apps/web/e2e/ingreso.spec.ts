import { expect, test } from '@playwright/test';
import { ACTORS } from './support/actors';
import { expectAccessible } from './support/accessibility';
import { acceptDataNotice, submitCredentials } from './support/sign-in';

// Valeria Montenueva no la usa ningún otro recorrido: su ingreso es el que se prueba aquí y su
// sesión queda guardada para `role-protection.spec.ts`, sin un segundo ingreso (límite de ingresos).
const actor = ACTORS.signInTeacher;

test('ingreso con aviso de datos: sin aceptarlo no se ve ninguna sección protegida', async ({
  page,
}) => {
  await submitCredentials(page, actor);

  const notice = page.getByRole('alertdialog', { name: /tratamiento/i });
  await expect(notice).toBeVisible();
  const accept = notice.getByRole('button', { name: 'Acepto y continuar' });
  await expect(accept).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Panel Docente' })).toHaveCount(0);

  // El aviso de datos solo existe en este momento: se revisa aquí con él abierto.
  await expectAccessible(page, 'ingreso · aviso de datos');

  // Con sesión pero sin aceptar, una ruta protegida devuelve al aviso y no pinta su contenido.
  await page.goto('/docente/planeacion');
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/\/ingreso\?volver=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Planeación GNS' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Panel Docente' })).toHaveCount(0);

  // Hay que marcar las tres casillas.
  const boxes = await notice.getByRole('checkbox').all();
  expect(boxes).toHaveLength(3);
  for (const box of boxes.slice(0, 2)) {
    await box.check();
  }
  await expect(accept).toBeDisabled();
  await boxes[2]?.check();
  await expect(accept).toBeEnabled();

  await acceptDataNotice(page);
  // `volver` lleva a la planeación que se había pedido.
  await expect(page).toHaveURL(/\/docente\/planeacion$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Planeación GNS' })).toBeVisible();
  await expect(page.getByRole('complementary')).toContainText(actor.name);

  await page.context().storageState({ path: actor.sessionFile });
});

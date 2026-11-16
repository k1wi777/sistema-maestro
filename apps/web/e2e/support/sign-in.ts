import { expect, type Page } from '@playwright/test';
import { usersPassword, type Actor } from './actors';

/** Marca las tres casillas del aviso de datos y lo acepta. */
export async function acceptDataNotice(page: Page): Promise<void> {
  const notice = page.getByRole('alertdialog', { name: /tratamiento/i });
  await expect(notice).toBeVisible();
  for (const box of await notice.getByRole('checkbox').all()) {
    await box.check();
  }
  await notice.getByRole('button', { name: 'Acepto y continuar' }).click();
  await expect(notice).toBeHidden();
}

/** Escribe las credenciales del actor en `/ingreso` y envía el formulario. */
export async function submitCredentials(page: Page, actor: Actor): Promise<void> {
  await page.goto('/ingreso');
  const submit = page.getByRole('button', { name: 'Ingresar' });
  // El botón se habilita al hidratar: antes de eso un envío no haría nada.
  await expect(submit).toBeEnabled();
  await page.getByLabel('Correo institucional').fill(actor.email);
  await page.getByLabel('Contraseña').fill(usersPassword());
  await submit.click();
}

/**
 * Ingreso completo por la interfaz: formulario y, como ningún usuario demo tiene aceptación
 * previa, aviso de datos. Termina cuando la sesión ya tiene vista (la del docente o la selección
 * de vista de coordinación).
 */
export async function signInThroughUi(page: Page, actor: Actor): Promise<void> {
  await submitCredentials(page, actor);
  await acceptDataNotice(page);
  const chooser = page.getByRole('navigation', { name: 'Vistas disponibles' });
  await expect
    .poll(async () => new URL(page.url()).pathname.startsWith('/docente') || chooser.isVisible())
    .toBe(true);
}

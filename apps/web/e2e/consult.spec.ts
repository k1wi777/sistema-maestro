import { expect, test, type Page } from '@playwright/test';
import { ACTORS, runMarker } from './support/actors';
import { openAs, type ActorPage } from './support/browser';

// Roles y límites (#115): administración consulta sin revisar; coordinación revisa sus grados y
// consulta el resto; y «Usuarios y roles» crea un usuario y le cambia el rol. El usuario que se crea
// es de la prueba (marcador único), así que no altera a ningún actor de otros recorridos.
const marker = runMarker();
const NEW_NAME = `Persona ${marker}`;
const NEW_EMAIL = `persona.${marker.toLowerCase()}@demo.gns.test`;
const NEW_PASSWORD = `Clave-${marker}-de-prueba`;

test.describe.configure({ mode: 'serial' });

async function settled(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(/^Cargando/)).toHaveCount(0);
}

test.describe('Solo consulta', () => {
  let admin: ActorPage;
  let coordinator: ActorPage;

  test.beforeAll(async ({ browser }) => {
    admin = await openAs(browser, ACTORS.consultAdmin);
    coordinator = await openAs(browser, ACTORS.consultCoordinator);
  });

  test.afterAll(async () => {
    await admin.context.close();
    await coordinator.context.close();
  });

  test('administración: el hub de Formatos es solo consulta y avisa del grado sin coordinadora', async () => {
    const { page } = admin;
    await page.goto('/administracion/formatos');
    await settled(page, 'Formatos');

    await expect(page.getByText('Todos los grados · Solo consulta')).toHaveCount(3);
    await expect(page.getByText('Grado sin coordinadora', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/First Grade no tiene coordinadora/)).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Grados y áreas', exact: true }).first(),
    ).toHaveAttribute('href', '/administracion/grados-y-areas');
  });

  test('administración abre una planeación: aviso de solo consulta, sin acciones de revisión', async () => {
    const { page } = admin;
    await page.goto('/administracion/formatos/planeaciones');
    await settled(page, 'Planeaciones');
    await expect(page.getByRole('columnheader', { name: 'Revisa' })).toBeVisible();

    await page
      .getByRole('link', { name: /^Ver\b/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Planeaciones');
    await expect(page.getByText('Solo consulta').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Aprobar|Devolver|Anular|Ajustar|Observar/ }),
    ).toHaveCount(0);
  });

  test('coordinación: la fila entera abre el registro y su enlace «Acción» conserva el nombre', async () => {
    const { page, context } = coordinator;
    await page.goto('/coordinacion/formatos/planeaciones');
    await settled(page, 'Planeaciones');

    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: /^(Revisar|Ver|Abrir) planeación de / }) })
      .first();
    await expect(row).toBeVisible();
    await expect(
      row.getByRole('link', { name: /^(Revisar|Ver|Abrir) planeación de .+/ }),
    ).toHaveCount(1);

    // Ctrl + clic en cualquier celda abre el registro en una pestaña nueva y la bandeja se queda.
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      row.getByRole('rowheader').click({ modifiers: ['Control'] }),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/\/coordinacion\/formatos\/planeaciones\/[0-9a-f-]{36}/);
    await popup.close();
    await expect(page).toHaveURL(/\/coordinacion\/formatos\/planeaciones$/);

    // Clic primario en una celda: navega al mismo destino que el enlace.
    await row.getByRole('rowheader').click();
    await expect(page).toHaveURL(/\/coordinacion\/formatos\/planeaciones\/[0-9a-f-]{36}/);
  });

  test('administración: la bitácora y las tablas con varias acciones por fila no son clicables', async () => {
    const { page } = admin;
    await page.goto('/administracion/formatos/planeaciones');
    await settled(page, 'Planeaciones');
    await expect(page.locator('tbody tr[data-clickable="true"]').first()).toBeVisible();

    await page.goto('/administracion/bitacora');
    await settled(page, 'Bitácora de actividad');
    await expect(page.getByRole('table', { name: 'Movimientos de la bitácora' })).toBeVisible();
    await expect(page.locator('tr[data-clickable="true"]')).toHaveCount(0);
  });

  test('coordinación: «Mis grados» y «Todo el colegio», con las ajenas en solo consulta', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion/formatos/planeaciones');
    await settled(page, 'Planeaciones');

    const scope = page.getByRole('radiogroup', { name: 'Ver registros de' });
    await expect(scope.getByRole('radio', { name: /^Mis grados/ })).toBeChecked();
    await scope.getByRole('radio', { name: 'Todo el colegio' }).click();
    await expect(page).toHaveURL(/vista=colegio/);
    await expect(page.getByRole('columnheader', { name: 'Revisa' })).toBeVisible();
    await expect(page.getByText('Solo consulta').first()).toBeVisible();

    await page
      .getByRole('link', { name: /^Ver\b/ })
      .first()
      .click();
    await expect(page.getByText('Solo consulta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Aprobar|Devolver|Anular/ })).toHaveCount(0);
  });
});

test.describe('Usuarios y roles', () => {
  let admin: ActorPage;

  test.beforeAll(async ({ browser }) => {
    admin = await openAs(browser, ACTORS.consultAdmin);
  });

  test.afterAll(async () => {
    await admin.context.close();
  });

  async function openUsers(page: Page): Promise<void> {
    await page.goto('/administracion/docentes?pestana=usuarios');
    await settled(page, 'Docentes y asignaciones');
    await expect(page.getByRole('tab', { name: 'Usuarios y roles', selected: true })).toBeVisible();
  }

  async function search(page: Page, text: string): Promise<void> {
    await page.getByRole('searchbox', { name: 'Buscar', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  }

  test('la cuenta propia no ofrece cambiar el rol ni el estado', async () => {
    const { page } = admin;
    await openUsers(page);
    const row = page.getByRole('row').filter({ hasText: 'Administrador GNS' });
    await expect(row.getByText('Es tu cuenta')).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
  });

  test('crea un usuario docente', async () => {
    const { page } = admin;
    await openUsers(page);
    await page.getByRole('button', { name: 'Nuevo usuario', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo usuario' });
    await dialog.getByRole('textbox', { name: /Nombre completo/ }).fill(NEW_NAME);
    await dialog.getByRole('textbox', { name: /Correo institucional/ }).fill(NEW_EMAIL);
    await dialog.getByRole('combobox', { name: /^Rol/ }).selectOption({ label: 'Docente' });
    await dialog.getByLabel(/Contraseña inicial/).fill(NEW_PASSWORD);
    await dialog.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(dialog).toBeHidden();

    await search(page, NEW_EMAIL);
    await expect(page.getByRole('row').filter({ hasText: NEW_NAME })).toContainText(/docente/i);
  });

  test('cambia el rol a coordinación tras el aviso de consecuencias', async () => {
    const { page } = admin;
    await openUsers(page);
    await search(page, NEW_EMAIL);
    await page.getByRole('button', { name: `Editar usuario ${NEW_NAME}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar usuario' });
    await dialog.getByRole('combobox', { name: /^Rol/ }).selectOption({ label: 'Coordinación' });
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();

    // Primero el aviso; el cambio no se aplica hasta confirmarlo.
    await expect(dialog.getByText('Qué pasa al cambiar el rol')).toBeVisible();
    await expect(dialog.getByText('Sus registros se conservan.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirmar cambio de rol' }).click();
    await expect(dialog).toBeHidden();

    await search(page, NEW_EMAIL);
    await expect(page.getByRole('row').filter({ hasText: NEW_NAME })).toContainText(
      /coordinación/i,
    );
  });

  test('desactiva al usuario creado', async () => {
    const { page } = admin;
    await openUsers(page);
    await search(page, NEW_EMAIL);
    await page.getByRole('button', { name: `Desactivar usuario ${NEW_NAME}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Desactivar usuario' });
    await dialog.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: NEW_NAME })).toContainText('Inactivo');
  });
});

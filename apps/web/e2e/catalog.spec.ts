import { expect, test, type Page } from '@playwright/test';
import { ACTORS, runMarker } from './support/actors';
import { openAs, type ActorPage } from './support/browser';

// Catálogo: coordinación crea un área, agrega un grupo, asigna a un docente a ese grupo como
// director(a), desactiva el área que ya tiene registros y borra la que no. Valeria Montenueva solo
// ingresa en `ingreso.spec.ts`, así que sus asignaciones nuevas no chocan con otros recorridos.
const marker = runMarker();
const USED_AREA = `Danza ${marker}`;
const FREE_AREA = `Teatro ${marker}`;
const TEACHER = 'Valeria Montenueva';
const LEVEL = 'Preescolar bajo';
const NEW_GRADE = `Grado ${marker}`;

test.describe.configure({ mode: 'serial' });

test.describe('Catálogo: grados, grupos y áreas', () => {
  let coordinator: ActorPage;

  test.beforeAll(async ({ browser }) => {
    coordinator = await openAs(browser, ACTORS.catalogCoordinator);
  });

  test.afterAll(async () => {
    await coordinator.context.close();
  });

  async function open(page: Page, path: string, title: string): Promise<void> {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/^Cargando/)).toHaveCount(0);
  }

  async function createArea(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Nueva área', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva área', exact: true });
    await dialog.getByRole('textbox', { name: /Nombre del área/ }).fill(name);
    await dialog.getByRole('checkbox', { name: LEVEL, exact: true }).check();
    await dialog.getByRole('button', { name: 'Guardar área', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
  }

  test('crea una área con uso y otra sin uso', async () => {
    const { page } = coordinator;
    await open(page, '/coordinacion/grados-y-areas', 'Grados y áreas');
    await page.getByRole('tab', { name: 'Áreas', exact: true }).click();

    await createArea(page, USED_AREA);
    await createArea(page, FREE_AREA);
  });

  test('crea un grado nuevo y le agrega su primer grupo', async () => {
    const { page } = coordinator;
    await page.getByRole('tab', { name: 'Grados y grupos', exact: true }).click();

    await page.getByRole('button', { name: 'Nuevo grado', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo grado' });
    await dialog.getByRole('combobox', { name: /^Nivel/ }).selectOption({ label: LEVEL });
    await dialog.getByRole('textbox', { name: /Nombre del grado/ }).fill(NEW_GRADE);
    await dialog.getByRole('button', { name: 'Guardar grado' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: LEVEL })).toBeVisible();
    await expect(page.getByText('Sin grupos').first()).toBeVisible();

    await page.getByRole('button', { name: `Agregar grupo a ${NEW_GRADE}`, exact: true }).click();
    const group = page.getByRole('dialog', { name: `Agregar grupo a ${NEW_GRADE}` });
    await group.getByRole('button', { name: 'Guardar grupo' }).click();
    await expect(group).toBeHidden();
    await expect(page.getByText(`${NEW_GRADE} 1 · Sin director(a)`)).toBeVisible();
  });

  test('agrega un grupo a un grado', async () => {
    const { page } = coordinator;
    await page.getByRole('tab', { name: 'Grados y grupos', exact: true }).click();

    await page.getByRole('button', { name: 'Agregar grupo a Red', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar grupo a Red' });
    await expect(dialog.getByRole('textbox', { name: /Nombre del grupo/ })).toHaveValue('Red 3');
    await dialog.getByRole('button', { name: 'Guardar grupo' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Red 3 · Sin director(a)')).toBeVisible();
  });

  test('asigna a un docente al grupo como director(a) y la página lo muestra', async () => {
    const { page } = coordinator;
    await open(page, '/coordinacion/docentes', 'Docentes y asignaciones');

    await page.getByRole('button', { name: `Asignaciones de ${TEACHER}` }).click();
    const dialog = page.getByRole('dialog', { name: `Asignaciones de ${TEACHER}` });
    await dialog
      .getByRole('combobox', { name: 'Grupo', exact: true })
      .selectOption({ label: `Red 3 · ${LEVEL}` });
    await dialog.getByRole('checkbox', { name: 'Director(a) de este grupo' }).check();
    await dialog.getByRole('checkbox', { name: USED_AREA }).check();
    await dialog.getByRole('button', { name: 'Asignar al grupo' }).click();
    await expect(dialog.getByText('Asignadas')).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: 'Director(a) de Red 3' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();

    await open(page, '/coordinacion/grados-y-areas', 'Grados y áreas');
    await expect(page.getByText(`Red 3 · Dir.: ${TEACHER}`)).toBeVisible();
  });

  test('desactiva el área en uso y borra la que no tiene uso', async () => {
    const { page } = coordinator;
    await page.getByRole('tab', { name: 'Áreas', exact: true }).click();
    const row = (name: string) => page.getByRole('row').filter({ hasText: name });

    await page.getByRole('button', { name: `Desactivar del área ${USED_AREA}` }).click();
    const deactivate = page.getByRole('dialog', { name: 'Desactivar' });
    await expect(deactivate.getByText(/no se puede borrar: se desactiva/)).toBeVisible();
    await deactivate.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(deactivate).toBeHidden();
    await expect(row(USED_AREA).getByText('Inactiva')).toBeVisible();

    await page.getByRole('button', { name: `Borrar del área ${FREE_AREA}` }).click();
    const remove = page.getByRole('dialog', { name: 'Borrar' });
    await remove.getByRole('button', { name: 'Borrar', exact: true }).click();
    await expect(remove).toBeHidden();
    await expect(row(FREE_AREA)).toHaveCount(0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { statusBadge } from './support/status';
import { ACTORS, runMarker } from './support/actors';
import { openAs, type ActorPage } from './support/browser';

// Andrés Peñaverde (7°) solo tiene diario del periodo 1 en la demo: el recorrido crea la hoja del
// periodo 2. Los nombres de pila son inventados y no están en los datos demo (R12).
const marker = runMarker();
const FIRST_NAMES = { positive: 'Xiomaro', improve: 'Tabarna', note: 'Quirino' };
const POSITIVE = `Participación ${marker}`;
const IMPROVE = `Retraso ${marker}`;
const ACTIONS = `Diálogo ${marker}`;
const NOTE = `Colaboración ${marker}`;
const COMMITMENT = `Felicitación ${marker}`;

test.describe.configure({ mode: 'serial' });

test.describe('Formatos: diario de campo y observador', () => {
  let teacher: ActorPage;
  let coordinator: ActorPage;
  let journalPath = '';
  let notePath = '';

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.formatsTeacher);
    coordinator = await openAs(browser, ACTORS.formatsCoordinator);
  });

  test.afterAll(async () => {
    await teacher.context.close();
    await coordinator.context.close();
  });

  async function confirmSend(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Enviar a coordinación' }).first().click();
    await page
      .getByRole('dialog', { name: 'Enviar a coordinación' })
      .getByRole('button', { name: 'Enviar a coordinación' })
      .click();
    await expect(statusBadge(page, 'Enviada · pendiente de revisión')).toBeVisible();
  }

  test('el docente registra y envía la hoja del diario de campo', async () => {
    const { page } = teacher;
    await page.goto('/docente');
    await page.getByRole('link', { name: 'Formatos' }).first().click();
    await page.getByRole('button', { name: 'Nueva hoja de diario' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva hoja de diario' });
    await dialog.getByLabel('Grado').selectOption({ label: '7°' });
    await dialog.getByLabel('Periodo').selectOption({ label: 'Periodo 2' });
    await dialog.getByRole('button', { name: 'Crear hoja' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '7° · Periodo 2' })).toBeVisible();
    journalPath = new URL(page.url()).pathname;

    const form = page.getByRole('form', { name: 'Nuevo registro' });
    await form.getByLabel('Clase o actividad').fill('Física');
    await form.getByLabel('Tipo de evento').selectOption({ label: 'Aspecto positivo' });
    await form.getByLabel('Estudiantes implicados').fill(FIRST_NAMES.positive);
    await form.getByLabel('Descripción del evento').fill(`${FIRST_NAMES.positive}: ${POSITIVE}`);
    await form.getByRole('button', { name: 'Agregar al diario' }).click();
    await expect(page.getByRole('article').filter({ hasText: POSITIVE })).toBeVisible();

    await form.getByLabel('Clase o actividad').fill('Física, repaso');
    await form.getByLabel('Tipo de evento').selectOption({ label: 'Aspecto por mejorar' });
    await form.getByLabel('Estudiantes implicados').fill(FIRST_NAMES.improve);
    await form.getByLabel('Descripción del evento').fill(`${FIRST_NAMES.improve}: ${IMPROVE}`);
    await form.getByLabel('Acciones de mejora').fill(ACTIONS);
    await form.getByRole('button', { name: 'Agregar al diario' }).click();
    const improve = page.getByRole('article').filter({ hasText: IMPROVE });
    await expect(improve).toContainText(ACTIONS);

    await confirmSend(page);
  });

  test('el docente registra y envía una anotación del observador', async () => {
    const { page } = teacher;
    await page.goto('/docente/formatos');
    await page.getByRole('tab', { name: 'Observador del estudiante' }).click();
    await page.getByRole('link', { name: 'Nueva anotación' }).click();

    await page.getByLabel('Grado').selectOption({ label: '7° · Bachillerato' });
    await page.getByLabel('Estudiante (nombre de pila)').fill(FIRST_NAMES.note);
    await page.getByLabel('Tipo de anotación').selectOption({ label: 'Reconocimiento positivo' });
    await page.getByLabel('Descripción de la situación').fill(`${FIRST_NAMES.note}: ${NOTE}`);
    await page.getByLabel('Acciones pedagógicas y compromisos').fill(COMMITMENT);
    await page.getByRole('button', { name: 'Guardar anotación' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: `Anotación de ${FIRST_NAMES.note}` }),
    ).toBeVisible();
    notePath = new URL(page.url()).pathname;

    await confirmSend(page);
  });

  test('coordinación revisa y aprueba el diario', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion');
    await page.getByRole('link', { name: 'Formatos' }).first().click();
    const row = page.getByRole('row').filter({ hasText: 'Andrés Peñaverde' }).filter({
      hasText: 'Periodo 2',
    });
    await expect(row).toContainText('Pendiente de revisión');
    await row.getByRole('link', { name: /Revisar/ }).click();

    await expect(page.getByText(POSITIVE)).toBeVisible();
    await expect(page.getByText(IMPROVE)).toBeVisible();
    await page.getByRole('button', { name: 'Marcar revisada' }).click();
    await expect(statusBadge(page, 'Revisada')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Historial de revisión' })).toContainText(
      ACTORS.formatsCoordinator.name,
    );
  });

  test('coordinación revisa y aprueba la anotación del observador', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion/formatos');
    await page.getByRole('tab', { name: /Observador del estudiante/ }).click();
    const row = page.getByRole('row').filter({ hasText: FIRST_NAMES.note });
    await expect(row).toContainText('Pendiente de revisión');
    await row.getByRole('link', { name: /Revisar/ }).click();

    await expect(page.getByText(NOTE)).toBeVisible();
    await page.getByRole('button', { name: 'Marcar revisada' }).click();
    await expect(statusBadge(page, 'Revisada')).toBeVisible();
  });

  test('el docente ve ambos registros revisados', async () => {
    const { page } = teacher;
    await page.goto(journalPath);
    await expect(statusBadge(page, 'Revisada')).toBeVisible();
    await expect(page.getByText(ACTORS.formatsCoordinator.name).first()).toBeVisible();

    await page.goto(notePath);
    await expect(statusBadge(page, 'Revisada')).toBeVisible();
  });
});

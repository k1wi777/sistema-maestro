import { expect, test, type Page } from '@playwright/test';
import { statusBadge } from './support/status';
import { ACTORS, runMarker } from './support/actors';
import { openAs, type ActorPage } from './support/browser';

// Sofía Marquesina no tiene planeación demo de Matemáticas de 4°, así que el recorrido crea la suya
// sin chocar con los datos demo (el mismo reparto de BE-92).
const marker = runMarker();
const TOPIC = `Tema ${marker}`;
const PERFORMANCE = `Desempeño ${marker}`;
const DEVELOPMENT = `Desarrollo ${marker}`;
const OBSERVATION = `Observación ${marker}`;
const CORRECTED = `Corregido ${marker}`;

test.describe.configure({ mode: 'serial' });

test.describe('Planeación: del borrador a la aprobación', () => {
  let teacher: ActorPage;
  let coordinator: ActorPage;
  let planUrl = '';

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.planningTeacher);
    coordinator = await openAs(browser, ACTORS.planningCoordinator);
  });

  test.afterAll(async () => {
    await teacher.context.close();
    await coordinator.context.close();
  });

  const inboxRow = (page: Page) => page.getByRole('row').filter({ hasText: TOPIC });
  const planCard = (page: Page) => page.getByRole('article').filter({ hasText: TOPIC });

  async function submitToCoordination(page: Page): Promise<void> {
    await page.getByRole('button', { name: /Revisar y enviar/ }).click();
    await page.getByRole('button', { name: 'Enviar a coordinación' }).first().click();
    await page
      .getByRole('dialog', { name: 'Enviar a coordinación' })
      .getByRole('button', { name: 'Enviar a coordinación' })
      .click();
    await expect(statusBadge(page, 'Enviada · pendiente de revisión')).toBeVisible();
  }

  test('el docente crea la planeación, la completa y la envía', async () => {
    const { page } = teacher;
    await page.goto('/docente');
    await page.getByRole('link', { name: 'Planeación GNS' }).click();
    await page.getByRole('link', { name: 'Nueva planeación' }).click();

    await page.getByLabel('Grado y área').selectOption({ label: '4° · Matemáticas' });
    await page.getByLabel('Periodo').selectOption({ label: 'Periodo 1' });
    await page.getByLabel('Proyecto o tema').fill(TOPIC);
    await page.getByRole('button', { name: 'Crear y continuar' }).click();

    await expect(page.getByRole('heading', { level: 1, name: new RegExp(TOPIC) })).toBeVisible();
    await expect(statusBadge(page, 'Borrador')).toBeVisible();
    planUrl = new URL(page.url()).pathname;

    // Sin el Momento 2 el envío está bloqueado.
    await page.getByRole('textbox', { name: 'Desempeño esperado' }).fill(PERFORMANCE);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible();
    await page.getByRole('button', { name: /Siguiente: Momentos/ }).click();
    await page.getByRole('textbox', { name: /Momento 2/ }).fill(DEVELOPMENT);
    await page.getByRole('button', { name: /Revisar y enviar/ }).click();
    await submitToCoordination(page);
  });

  test('coordinación la encuentra en la bandeja y la devuelve con observaciones', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion');
    await page.getByRole('link', { name: 'Planeaciones' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Planeaciones' })).toBeVisible();

    const row = inboxRow(page);
    await expect(row).toContainText('Sofía Marquesina');
    await expect(row).toContainText('Pendiente de revisión');
    await row.getByRole('link', { name: /Revisar/ }).click();

    await expect(page.getByText(DEVELOPMENT)).toBeVisible();
    await page.getByLabel('Observación general').fill(OBSERVATION);
    await page.getByRole('button', { name: 'Devolver con observaciones' }).click();
    await page
      .getByRole('dialog', { name: 'Devolver con observaciones' })
      .getByRole('button', { name: 'Devolver' })
      .click();
    await expect(statusBadge(page, 'Con observaciones')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Historial' })).toContainText(OBSERVATION);
  });

  test('el docente ve las observaciones, corrige y reenvía', async () => {
    const { page } = teacher;
    await page.goto('/docente/planeacion');
    const card = planCard(page);
    await expect(card).toContainText('Con observaciones');
    await card.getByRole('link', { name: /Continuar/ }).click();

    const feedback = page.getByRole('note').filter({ hasText: 'Observaciones de coordinación' });
    await expect(feedback).toContainText(OBSERVATION);
    await expect(feedback).toContainText('Elena Ravassa');

    await page
      .getByRole('button', { name: /Momentos de la clase/ })
      .first()
      .click();
    await page.getByRole('textbox', { name: /Momento 2/ }).fill(CORRECTED);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible();
    await submitToCoordination(page);
  });

  test('coordinación la aprueba y ambos ven el estado final', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion/planeaciones');
    await inboxRow(page)
      .getByRole('link', { name: /Revisar/ })
      .click();
    await expect(page.getByText(CORRECTED)).toBeVisible();
    const reviewPath = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'Aprobar y pasar a la siguiente' }).click();

    // Aprobar lleva a la siguiente pendiente: el estado final se comprueba en la bandeja.
    await page.waitForURL((url) => url.pathname !== reviewPath);
    await page.goto('/coordinacion/planeaciones');
    await expect(inboxRow(page)).toContainText('Revisada');

    await teacher.page.goto('/docente/planeacion');
    await expect(planCard(teacher.page)).toContainText('Revisada');
    await teacher.page.goto(planUrl);
    await expect(statusBadge(teacher.page, 'Revisada')).toBeVisible();
  });
});

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ACTORS } from './support/actors';
import { openAs, type ActorPage } from './support/browser';
import { playChallengeToTheEnd } from './support/challenge';

// Daniela Fontalba no tiene progreso de formación en los datos demo. El módulo 0 solo tiene el
// Desafío GNS (6 preguntas, se aprueba con 80 %), así que superarlo lo termina.
const MODULE_NUMBER = '0';
const MODULE_TITLE = 'Bienvenida institucional GNS';
const CODE_PATTERN = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/;

test.describe.configure({ mode: 'serial' });

test.describe('Formación: Desafío GNS y certificado', () => {
  let teacher: ActorPage;
  let code = '';

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.trainingTeacher);
  });

  test.afterAll(async () => {
    await teacher.context.close();
  });

  test('el docente supera el Desafío del módulo 0 respondiendo en la interfaz', async () => {
    const { page } = teacher;
    await page.goto('/docente/formacion');
    await expect(
      page.getByRole('paragraph').filter({ hasText: /^0\s*de 9 módulos terminados/ }),
    ).toBeVisible();
    await page.getByRole('link', { name: MODULE_TITLE }).click();
    await expect(page.getByRole('heading', { level: 1, name: MODULE_TITLE })).toBeVisible();

    await playChallengeToTheEnd(page, MODULE_NUMBER);
    // El panel final reemplaza a la pregunta: el foco queda en su acción, no en el cuerpo (R10).
    await expect(page.getByRole('button', { name: 'Intentar de nuevo' })).toBeFocused();

    await expect(page.getByRole('heading', { name: '¡Aprobaste el Desafío GNS!' })).toBeVisible();
    await expect(page.getByText('¡Terminaste este módulo!')).toBeVisible();
    await expect(page.getByText('Terminado', { exact: true }).first()).toBeVisible();
  });

  test('descarga el certificado: un archivo PDF válido', async () => {
    const { page } = teacher;
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar certificado' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const file = await download.path();
    expect(readFileSync(file).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('el panel de certificados muestra el código del módulo', async () => {
    const { page } = teacher;
    await page.goto('/docente/formacion/progreso');
    const issued = page
      .getByRole('list', { name: 'Certificados de módulo emitidos' })
      .getByRole('listitem')
      .filter({ hasText: MODULE_TITLE });
    await expect(issued).toHaveCount(1);
    const codeText = await issued.getByText(CODE_PATTERN).textContent();
    expect(codeText).toMatch(CODE_PATTERN);
    code = codeText ?? '';
  });

  test('cualquiera, sin sesión, verifica el código en /verificar', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/verificar');
      await page.getByLabel('Código del certificado').fill(code);
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.getByText('Certificado válido')).toBeVisible();
      await expect(page.getByText(ACTORS.trainingTeacher.name)).toBeVisible();
      await expect(page.getByText(MODULE_TITLE)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

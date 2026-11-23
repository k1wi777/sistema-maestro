import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ACTORS } from './support/actors';
import { expectAccessible, expectNoHorizontalScroll } from './support/accessibility';
import { openAs, type ActorPage } from './support/browser';

// Presentación en PDF como diapositivas. El módulo 8 de la inducción no trae presentación en los
// datos demo: coordinación le sube un PDF de 3 páginas, lo ve en la vista previa (sin marcar
// progreso) y un docente que no usa ningún otro recorrido de formación lo recorre. Va al final de
// la suite para que lo que escribe no altere los conteos de los demás recorridos.
const FIXTURE = join(__dirname, 'fixtures', 'presentacion-prueba.pdf');
const FILE_NAME = 'presentacion-prueba.pdf';
const MODULE_TITLE = 'Plan de beneficios GNS 2026–2027';
const DESKTOP = { width: 1280, height: 720 };

test.describe.configure({ mode: 'serial' });

/**
 * Captura para comparar con el tablero: se adjunta al informe y se guarda en
 * `test-results/visual/` (el informe de una prueba que pasa no conserva sus adjuntos).
 */
async function attachScreenshot(page: Page, name: string): Promise<void> {
  const path = join(__dirname, '..', 'test-results', 'visual', `${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: 'image/png' });
}

/** La página dibujada: el canvas es una imagen con el nombre «Página n de m de <archivo>». */
function pageImage(page: Page, current: number) {
  return page.getByRole('img', { name: `Página ${current} de 3 de ${FILE_NAME}` });
}

test.describe('Presentación en PDF: coordinación sube y previsualiza', () => {
  let coordinator: ActorPage;

  test.beforeAll(async ({ browser }) => {
    coordinator = await openAs(browser, ACTORS.presentationCoordinator);
  });

  test.afterAll(async () => {
    await coordinator.context.close();
  });

  test('sube el PDF en el paso «Presentación» del módulo 8', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion/planes');
    await page
      .getByRole('link', { name: new RegExp(`^Editar.*${MODULE_TITLE}`) })
      .first()
      .click();
    await page.getByRole('button', { name: /^Paso \d+: Presentación/ }).click();
    await page.getByRole('radio', { name: 'Archivo' }).click();
    await page.getByLabel(/^Archivo de la presentación/).setInputFiles(FIXTURE);
    await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
  });

  test('la vista previa muestra el PDF página por página sin marcar progreso', async () => {
    const { page } = coordinator;
    await page.getByRole('button', { name: /^Paso \d+: Vista previa/ }).click();
    await expect(pageImage(page, 1)).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByText('Página 1 de 3', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
    await expect(pageImage(page, 2)).toBeVisible();
    // La vista previa no marca nada: ni aunque se llegue a la última página.
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByText('Página 3 de 3', { exact: true })).toBeVisible();
    await expect(page.getByText('Presentación revisada')).toHaveCount(0);
  });
});

test.describe('Presentación en PDF: recorrido del docente', () => {
  let teacher: ActorPage;

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.presentationTeacher);
  });

  test.afterAll(async () => {
    await teacher.context.close();
  });

  test('abre el módulo: una página a la vez, sin visor del navegador', async () => {
    const { page } = teacher;
    await page.goto('/docente/formacion');
    await page
      .getByRole('link', { name: new RegExp(MODULE_TITLE) })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: MODULE_TITLE })).toBeVisible();
    await expect(pageImage(page, 1)).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByText('Página 1 de 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await expect(page.getByText('Presentación revisada')).toHaveCount(0);
  });

  test('avanza con el teclado y con los botones; al llegar a la última queda revisada', async () => {
    const { page } = teacher;
    await page.getByRole('group', { name: new RegExp(`^Presentación: ${FILE_NAME}`) }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
    await expect(pageImage(page, 2)).toBeVisible();

    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByText('Página 3 de 3', { exact: true })).toBeVisible();
    await expect(pageImage(page, 3)).toBeVisible();
    await expect(page.getByText('Presentación revisada').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  });

  test('ofrece pantalla completa y descarga el PDF con su nombre original', async () => {
    const { page } = teacher;
    await expect(page.getByRole('button', { name: 'Pantalla completa' })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar PDF' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(FILE_NAME);
    const file = await download.path();
    expect(readFileSync(file).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('en pantalla completa los controles y el teclado siguen funcionando', async () => {
    const { page } = teacher;
    await page.getByRole('button', { name: 'Pantalla completa' }).click();
    await expect(page.getByRole('button', { name: 'Salir de pantalla completa' })).toBeVisible();
    await expect(pageImage(page, 2)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Página 3 de 3', { exact: true })).toBeVisible();
    await attachScreenshot(page, 'pantalla-completa');
    await page.getByRole('button', { name: 'Salir de pantalla completa' }).click();
    await expect(page.getByRole('button', { name: 'Pantalla completa' })).toBeVisible();
  });

  test('accesibilidad: claro y oscuro, sin desplazamiento horizontal a 375 y 768 px', async () => {
    const { page } = teacher;
    await expectAccessible(page, 'docente · módulo con presentación en PDF');
    await page.emulateMedia({ colorScheme: 'dark' });
    await attachScreenshot(page, 'visor-1280-oscuro');
    await page.emulateMedia({ colorScheme: 'light' });
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: DESKTOP.height });
      await expect(pageImage(page, 3)).toBeVisible();
      await expectNoHorizontalScroll(page, `módulo con PDF a ${width} px`);
      await attachScreenshot(page, `visor-${width}-claro`);
    }
    await expectAccessible(page, 'docente · módulo con PDF a 375 px', ['light']);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: null });
  });
});

import { expect, test, type Locator, type Page } from '@playwright/test';
import { ACTORS } from './support/actors';
import { expectAccessible, expectNoHorizontalScroll } from './support/accessibility';
import { openAs, type ActorPage } from './support/browser';

// Revisión de accesibilidad (FE-42): cada pantalla principal pasa por axe-core en tema claro y
// oscuro (falla con lo grave y con la estructura de encabezados) y se muestra a 375 y 768 px sin
// desplazamiento horizontal. Julián Casaverde y una segunda sesión de Elena Ravassa son actores
// propios. Solo se escribe una cosa: la partida del Desafío de Julián; el diálogo de devolución se
// abre y se cancela.
const DESKTOP = { width: 1280, height: 720 };
const NARROW_WIDTHS = [375, 768];

/** Espera a que la pantalla esté pintada: encabezado principal y ninguna carga pendiente. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/^Cargando/)).toHaveCount(0);
}

/** Revisión completa de la pantalla actual: temas y anchos estrechos. */
async function audit(page: Page, label: string): Promise<void> {
  await settled(page);
  await expectAccessible(page, label);
  await page.emulateMedia({ colorScheme: 'light' });
  for (const width of NARROW_WIDTHS) {
    await page.setViewportSize({ width, height: DESKTOP.height });
    await expectNoHorizontalScroll(page, `${label} a ${width} px`);
    // En celular algunos controles cambian (menú de la cuenta): también se revisa con axe.
    if (width === NARROW_WIDTHS[0]) {
      await expectAccessible(page, `${label} a ${width} px`, ['light']);
    }
  }
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: null });
}

async function visit(page: Page, path: string, label: string): Promise<void> {
  await page.goto(path);
  await audit(page, label);
}

/** Abre el primer enlace de la lista y revisa la pantalla a la que lleva. */
async function openFirst(page: Page, link: Locator, label: string): Promise<void> {
  await expect(link.first()).toBeVisible();
  const listUrl = page.url();
  await link.first().click();
  // Sin esperar el cambio de ruta, el análisis podría medir todavía la pantalla de la lista.
  await page.waitForURL((url) => url.toString() !== listUrl);
  await audit(page, label);
}

const OPEN_LINK = /^(Ver|Abrir|Continuar)\b/;

test.describe('Accesibilidad: sin sesión', () => {
  for (const [path, label] of [
    ['/ingreso', 'ingreso'],
    ['/politica-de-tratamiento', 'política de tratamiento'],
    ['/terminos-de-uso', 'términos de uso'],
    ['/verificar', 'verificar certificado'],
  ] as const) {
    test(label, async ({ page }) => {
      await visit(page, path, label);
    });
  }
});

test.describe('Accesibilidad: vista docente', () => {
  let teacher: ActorPage;

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.accessibilityTeacher);
  });

  test.afterAll(async () => {
    await teacher.context.close();
  });

  test('planeación: lista, planeación en solo lectura y nueva', async () => {
    const { page } = teacher;
    await visit(page, '/docente/planeacion', 'docente · planeaciones');
    await openFirst(page, page.getByRole('link', { name: /^Ver\b/ }), 'docente · planeación');
    await visit(page, '/docente/planeacion/nueva', 'docente · nueva planeación');
  });

  test('formatos: ambas pestañas, un diario y una anotación', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formatos', 'docente · formatos (diario)');
    await openFirst(page, page.getByRole('link', { name: OPEN_LINK }), 'docente · diario');

    await page.goto('/docente/formatos');
    await page.getByRole('tab', { name: 'Observador del estudiante' }).click();
    await audit(page, 'docente · formatos (observador)');
    await openFirst(page, page.getByRole('link', { name: OPEN_LINK }), 'docente · anotación');
  });

  test('formación: ruta, progreso y un módulo con el Desafío', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formacion', 'docente · formación');

    // Cada pestaña es una página: al cambiar de pestaña el foco sigue en la pestaña activa (R11).
    await page.getByRole('tab', { name: 'Mi progreso y certificados' }).click();
    await expect(page).toHaveURL(/\/docente\/formacion\/progreso$/);
    await expect(page.getByRole('tab', { name: 'Mi progreso y certificados' })).toBeFocused();
    await visit(page, '/docente/formacion/progreso', 'docente · progreso');

    await page.goto('/docente/formacion');
    await page
      .getByRole('link', { name: /Bienvenida institucional GNS/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bienvenida institucional GNS' }),
    ).toBeVisible();
    await audit(page, 'docente · módulo');

    const game = page.getByRole('group', { name: 'Desafío GNS' });
    await expectAccessible(page, 'docente · Desafío (lobby)');
    await game.getByRole('button', { name: /^(Jugar|Intentar de nuevo)$/ }).click();
    await expect(game.getByText(/^1 \/ \d+$/)).toBeVisible();
    await expectAccessible(page, 'docente · Desafío (pregunta)');
  });

  test('asistente', async () => {
    await visit(teacher.page, '/docente/asistente', 'docente · asistente');
  });
});

test.describe('Accesibilidad: vista de coordinación', () => {
  let coordinator: ActorPage;

  test.beforeAll(async ({ browser }) => {
    coordinator = await openAs(browser, ACTORS.accessibilityCoordinator);
  });

  test.afterAll(async () => {
    await coordinator.context.close();
  });

  test('planeaciones: bandeja, una planeación y el diálogo de devolución', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/planeaciones', 'coordinación · planeaciones');
    await openFirst(
      page,
      page.getByRole('link', { name: /^Revisar\b/ }),
      'coordinación · planeación',
    );

    // Sin observación el botón solo avisa: se escribe una (no se guarda nada) y luego se cancela.
    const observation = page.getByLabel('Observación general');
    await observation.fill('Observación de prueba de accesibilidad.');
    await page.getByRole('button', { name: 'Devolver con observaciones' }).click();
    const dialog = page.getByRole('dialog', { name: 'Devolver con observaciones' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page, 'coordinación · diálogo de devolución');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('formatos: ambas pestañas y un diario', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/formatos', 'coordinación · formatos (diario)');
    await openFirst(page, page.getByRole('link', { name: /^Revisar\b/ }), 'coordinación · diario');

    await page.goto('/coordinacion/formatos');
    await page.getByRole('tab', { name: 'Observador del estudiante' }).click();
    await audit(page, 'coordinación · formatos (observador)');
  });

  test('vista previa de un módulo con video de YouTube incrustado', async () => {
    const { page } = coordinator;
    // Sin red externa: el reproductor de YouTube se sustituye por una página local mínima.
    await page.route('https://www.youtube-nocookie.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Video</title>' }),
    );
    await page.goto('/coordinacion/planes');
    await expect(
      page.getByRole('link', { name: /Antecedente histórico GNS/ }).first(),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /^Editar.*Antecedente histórico GNS/ })
      .first()
      .click();
    await page.getByRole('button', { name: /Vista previa/ }).click();

    const frame = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('title', /\S/);
    expect(await frame.getAttribute('src')).not.toContain('autoplay');
    await expect(page.getByRole('link', { name: /^Ver en YouTube/ })).toBeVisible();
    await audit(page, 'coordinación · vista previa con video');
  });

  test('docentes, planes, módulo, avance, bitácora y asistente', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/docentes', 'coordinación · docentes');
    await visit(page, '/coordinacion/planes', 'coordinación · planes');
    await openFirst(
      page,
      page.getByRole('link', { name: /^(Editar|Abrir|Ver)\b/ }),
      'coordinación · módulo',
    );
    await visit(page, '/coordinacion/avance', 'coordinación · avance');
    await visit(page, '/coordinacion/bitacora', 'coordinación · bitácora');
    await visit(page, '/coordinacion/asistente', 'coordinación · asistente');
  });
});

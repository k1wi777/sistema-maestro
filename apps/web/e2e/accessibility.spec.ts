import { expect, test, type Locator, type Page } from '@playwright/test';
import { ACTORS } from './support/actors';
import { expectAccessible, expectNoHorizontalScroll } from './support/accessibility';
import { openAs, type ActorPage } from './support/browser';

// Revisión de accesibilidad (FE-42): cada pantalla principal pasa por axe-core en tema claro y
// oscuro (falla con lo grave y con la estructura de encabezados) y se muestra a 375 y 768 px sin
// desplazamiento horizontal. Julián Casaverde y una segunda sesión de Elena Ravassa son actores
// propios, igual que una sesión de administración. Solo se escribe una cosa: la partida del Desafío de Julián; el diálogo de devolución se
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

  test('formatos: hub de tarjetas y PIAR «pronto» sin enlace', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formatos', 'docente · formatos (hub)');
    await expect(page.getByRole('heading', { level: 2, name: 'PIAR · Inclusión' })).toBeVisible();
    await expect(page.getByRole('link', { name: /PIAR/ })).toHaveCount(0);
  });

  test('planeación: lista, planeación en solo lectura y nueva', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formatos/planeacion', 'docente · planeaciones');
    await openFirst(page, page.getByRole('link', { name: /^Ver\b/ }), 'docente · planeación');
    await visit(page, '/docente/formatos/planeacion/nueva', 'docente · nueva planeación');
  });

  test('diario de campo: lista, diario del día (aportante y director) y confirmación de envío', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formatos/diario', 'docente · diario de campo (lista)');
    // Julián participa en Red 1 (aportante) y dirige Transition 1 (director): los diarios demo del
    // 9 de nov están en curso. Solo se abre y se cancela el diálogo de envío.
    await openFirst(
      page,
      page.getByRole('link', { name: /^Abrir diario de Red 1 del 2026-11-09/ }),
      'docente · diario del día (aportante)',
    );
    await page.goBack();
    await openFirst(
      page,
      page.getByRole('link', { name: /^Abrir diario de Transition 1 del 2026-11-09/ }),
      'docente · diario del día (director)',
    );
    await page.getByRole('button', { name: 'Enviar a coordinación' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enviar a coordinación' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page, 'docente · confirmación de envío del diario');
    await dialog.getByRole('button', { name: 'Seguir esperando' }).click();
    await expect(dialog).toBeHidden();
  });

  test('descartar borrador: los tres diálogos y el selector de tema', async () => {
    const { page } = teacher;
    const discardDialog = page.getByRole('dialog', { name: 'Descartar borrador' });

    // Diario: Julián tiene un borrador propio en el diario demo en curso de Red 1.
    await page.goto('/docente/formatos/diario');
    await page.getByRole('link', { name: /^Abrir diario de Red 1 del 2026-11-09/ }).click();
    await settled(page);
    await page.getByRole('button', { name: /^Descartar borrador/ }).click();
    await expect(discardDialog).toBeVisible();
    await expectAccessible(page, 'docente · descartar anotación del diario');
    await discardDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(discardDialog).toBeHidden();

    // Planeación y observador: se crea un borrador, se revisa el diálogo y se descarta (queda como estaba).
    await page.goto('/docente/formatos/planeacion/nueva');
    await page
      .getByRole('combobox', { name: 'Grado', exact: true })
      .selectOption({ label: 'Transition' });
    await page
      .getByRole('combobox', { name: 'Periodo', exact: true })
      .selectOption({ label: 'Periodo 1' });
    await page.getByLabel('Proyecto o tema').fill('Borrador de accesibilidad');
    await page.getByRole('button', { name: 'Crear y continuar' }).click();
    await settled(page);
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Descartar borrador' }).click();
    await expect(discardDialog).toBeVisible();
    await expectAccessible(page, 'docente · descartar planeación');
    await discardDialog.getByRole('button', { name: 'Descartar borrador' }).click();
    await expect(page).toHaveURL(/aviso=descartado/);

    await page.goto('/docente/formatos/observador/nueva');
    await page.getByLabel('Grado').selectOption({ label: 'Transition · Preescolar alto (KTF)' });
    await page.getByLabel('Estudiante (nombre de pila)').fill('Acacio');
    await page.getByLabel('Tipo de anotación').selectOption({ label: 'Reconocimiento positivo' });
    await page.getByLabel('Comportamiento específico').fill('Borrador de accesibilidad');
    await page.getByRole('button', { name: 'Guardar anotación' }).click();
    await settled(page);
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Descartar borrador' }).click();
    await expect(discardDialog).toBeVisible();
    await expectAccessible(page, 'docente · descartar anotación del observador');
    await discardDialog.getByRole('button', { name: 'Descartar borrador' }).click();
    await expect(page).toHaveURL(/aviso=descartado/);
  });

  test('selector de tema: grupo de opción única con tres iconos, un solo selector visible', async () => {
    const { page } = teacher;
    const group = page.getByRole('radiogroup', { name: 'Tema de la plataforma' });
    await page.goto('/docente/formatos');
    await settled(page);

    // Un solo selector, dentro del bloque de la cuenta: sin el texto «Tema», con los enlaces legales
    // debajo del bloque y «Cerrar sesión» dentro de él.
    await expect(group).toHaveCount(1);
    const aside = page.getByRole('complementary');
    await expect(aside.getByText('Tema', { exact: true })).toHaveCount(0);
    await expect(aside.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(aside.getByRole('navigation', { name: 'Documentos legales' })).toBeVisible();

    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 720 });
      if (width === 375) {
        // En celular la barra solo lleva la marca y el botón de la cuenta: el selector está en el panel.
        await expect(group).toBeHidden();
        await page.getByRole('button', { name: /cuenta y opciones$/ }).click();
      }
      await expect(group).toBeVisible();
      await expect(group.getByRole('radio')).toHaveText(['Claro', 'Oscuro', 'Sistema']);
      await expect(group.getByRole('radio', { name: 'Sistema' })).toBeChecked();
      await expectNoHorizontalScroll(page, `selector de tema a ${width} px`);
    }

    await group.getByRole('radio', { name: 'Claro' }).click();
    await expect(group.getByRole('radio', { name: 'Claro' })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('End');
    await expect(group.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    await page.keyboard.press('Home');
    await expect(group.getByRole('radio', { name: 'Claro' })).toBeChecked();
    await expectAccessible(page, 'docente · selector de tema a 375 px', ['light']);

    await page.setViewportSize(DESKTOP);
    await expectAccessible(page, 'docente · selector de tema');
    await group.getByRole('radio', { name: 'Sistema' }).click();
    await expect(group.getByRole('radio', { name: 'Sistema' })).toBeChecked();
  });

  test('observador: lista y una anotación', async () => {
    const { page } = teacher;
    await visit(page, '/docente/formatos/observador', 'docente · observador (lista)');
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

  test('formatos: hub de tarjetas con pendientes', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/formatos', 'coordinación · formatos (hub)');
    await expect(page.getByRole('link', { name: /^Planeaciones\b.*pendiente/ })).toBeVisible();
  });

  test('planeaciones: bandeja, una planeación y el diálogo de devolución', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/formatos/planeaciones', 'coordinación · planeaciones');
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

  test('diarios de campo y observadores: bandejas y un diario', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/formatos/diario', 'coordinación · diarios de campo');
    await openFirst(page, page.getByRole('link', { name: /^Revisar\b/ }), 'coordinación · diario');

    await visit(page, '/coordinacion/formatos/observador', 'coordinación · observadores');
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

  test('docentes (solo sus grupos), planes, módulo, avance y asistente', async () => {
    const { page } = coordinator;
    await visit(page, '/coordinacion/docentes', 'coordinación · docentes');
    await page
      .getByRole('button', { name: /^Asignaciones de / })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page, 'coordinación · diálogo de asignaciones');
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await visit(page, '/coordinacion/planes', 'coordinación · planes');
    await page.getByRole('button', { name: 'Crear nueva sección' }).click();
    await expect(page.getByRole('dialog', { name: 'Crear nueva sección' })).toBeVisible();
    await audit(page, 'coordinación · diálogo de nueva sección');
    await page
      .getByRole('dialog', { name: 'Crear nueva sección' })
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page
      .getByRole('button', { name: /^Nuevo módulo en la sección / })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Nuevo módulo' })).toBeVisible();
    await audit(page, 'coordinación · diálogo de nuevo módulo');
    await page
      .getByRole('dialog', { name: 'Nuevo módulo' })
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await openFirst(
      page,
      page.getByRole('link', { name: /^(Editar|Abrir|Ver)\b/ }),
      'coordinación · módulo',
    );
    await visit(page, '/coordinacion/avance', 'coordinación · avance');
    await visit(page, '/coordinacion/asistente', 'coordinación · asistente');
  });

  test('formatos: «Todo el colegio» y una planeación ajena en solo consulta', async () => {
    const { page } = coordinator;
    await visit(
      page,
      '/coordinacion/formatos/planeaciones?vista=colegio',
      'coordinación · todo el colegio',
    );
    await openFirst(
      page,
      page.getByRole('link', { name: /^Ver\b/ }),
      'coordinación · planeación en solo consulta',
    );
    await expect(page.getByText('Solo consulta').first()).toBeVisible();
  });
});

test.describe('Accesibilidad: vista de administración', () => {
  let admin: ActorPage;

  test.beforeAll(async ({ browser }) => {
    admin = await openAs(browser, ACTORS.accessibilityAdmin);
  });

  test.afterAll(async () => {
    await admin.context.close();
  });

  test('formatos: hub, bandejas y una planeación en solo consulta', async () => {
    const { page } = admin;
    await visit(page, '/administracion/formatos', 'administración · formatos (hub)');
    await expect(page.getByText('Todos los grados · Solo consulta').first()).toBeVisible();
    await visit(page, '/administracion/formatos/planeaciones', 'administración · planeaciones');
    await openFirst(
      page,
      page.getByRole('link', { name: /^Ver\b/ }),
      'administración · planeación en solo consulta',
    );
    await expect(page.getByText('Solo consulta').first()).toBeVisible();
    await visit(page, '/administracion/formatos/diario', 'administración · diarios de campo');
    await visit(page, '/administracion/formatos/observador', 'administración · observadores');
  });

  test('docentes: asignaciones y usuarios y roles, bitácora y grados y áreas', async () => {
    const { page } = admin;
    await visit(page, '/administracion/docentes', 'administración · docentes (asignaciones)');
    await page.getByRole('tab', { name: 'Usuarios y roles', exact: true }).click();
    await expect(page.getByText('Es tu cuenta')).toBeVisible();
    await audit(page, 'administración · usuarios y roles');
    await page.getByRole('button', { name: 'Nuevo usuario', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo usuario' })).toBeVisible();
    await audit(page, 'administración · diálogo de nuevo usuario');
    await page
      .getByRole('dialog', { name: 'Nuevo usuario' })
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await visit(page, '/administracion/bitacora', 'administración · bitácora');
    await visit(page, '/administracion/grados-y-areas', 'administración · grados y grupos');
    await page.getByRole('button', { name: 'Nuevo grado', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo grado' })).toBeVisible();
    await audit(page, 'administración · diálogo de nuevo grado');
    await page
      .getByRole('dialog', { name: 'Nuevo grado' })
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('tab', { name: 'Áreas', exact: true }).click();
    await audit(page, 'administración · áreas');
    await page.getByRole('tab', { name: 'Coordinadoras', exact: true }).click();
    await audit(page, 'administración · coordinadoras');
  });
});

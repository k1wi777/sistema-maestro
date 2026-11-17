import { expect, test, type Page } from '@playwright/test';
import { statusBadge } from './support/status';
import { ACTORS, runMarker } from './support/actors';
import { openAs, type ActorPage } from './support/browser';

// Diario colaborativo de 7° 1: Sofía (matemáticas) anota, Andrés (director de grupo) lo envía y
// Tomás (coordinador de 7°) lo devuelve con una observación y lo aprueba. Ningún diario demo de 7° 1
// es de hoy: el recorrido crea el de hoy. Los nombres de pila son inventados y no están en los datos
// demo (R12).
const marker = runMarker();
const FIRST_NAMES = { positive: 'Xiomaro', note: 'Quirino' };
const POSITIVE = `Participación ${marker}`;
const CORRECTED = `Corregida ${marker}`;
const OBSERVATION = `Amplía el contexto ${marker}`;
const NOTE = `Colaboración ${marker}`;
const COMMITMENT = `Felicitación ${marker}`;
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

test.describe.configure({ mode: 'serial' });

test.describe('Formatos: diario de campo y observador', () => {
  let teacher: ActorPage;
  let participant: ActorPage;
  let coordinator: ActorPage;
  let journalPath = '';
  let reviewPath = '';
  let notePath = '';

  test.beforeAll(async ({ browser }) => {
    teacher = await openAs(browser, ACTORS.formatsTeacher);
    participant = await openAs(browser, ACTORS.journalParticipant);
    coordinator = await openAs(browser, ACTORS.formatsCoordinator);
  });

  test.afterAll(async () => {
    await teacher.context.close();
    await participant.context.close();
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

  test('una docente agrega su anotación de hoy al diario del grupo y la marca lista', async () => {
    const { page } = participant;
    await page.goto('/docente');
    await page.getByRole('link', { name: 'Formatos' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Formatos' })).toBeVisible();
    await page.getByRole('link', { name: /^Diario de campo \(F-PA-05\)/ }).click();
    await expect(page).toHaveURL(/\/docente\/formatos\/diario$/);
    await expect(page.getByRole('heading', { level: 2, name: /^Hoy · / })).toBeVisible();

    await page.getByRole('button', { name: 'Agregar anotación' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar anotación' });
    await dialog.getByLabel('Grupo').selectOption({ label: '7° 1' });
    await expect(dialog.getByLabel('Fecha')).toHaveValue(TODAY);
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(new RegExp(`/docente/formatos/diario/[^/]+/${TODAY}$`));
    await expect(page.getByRole('heading', { level: 1, name: /^7° 1 · / })).toBeVisible();
    journalPath = new URL(page.url()).pathname;

    const form = page.getByRole('form', { name: 'Nueva anotación' });
    await form.getByLabel('Asignatura').selectOption({ label: 'Matemáticas' });
    await form.getByLabel('Tipo de evento').selectOption({ label: 'Aspecto positivo' });
    await form.getByLabel('Estudiantes implicados').fill(FIRST_NAMES.positive);
    await form.getByLabel('Descripción del evento').fill(`${FIRST_NAMES.positive}: ${POSITIVE}`);
    await form.getByRole('button', { name: 'Guardar borrador' }).click();

    const card = page.getByRole('article', { name: 'Anotación de Matemáticas' });
    await expect(card).toContainText(POSITIVE);
    await expect(card.getByText('Borrador', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: /^Marcar como lista/ }).click();
    await expect(card.getByText(/^Lista · /)).toBeVisible();
  });

  test('el director de grupo ve el aporte, confirma el envío y el diario queda enviado', async () => {
    const { page } = teacher;
    await page.goto(journalPath);
    await expect(page.getByRole('heading', { level: 1, name: /^7° 1 · / })).toBeVisible();
    const contributions = page.getByRole('table', { name: 'Aportes de los docentes de 7° 1' });
    await expect(
      contributions.getByRole('row').filter({ hasText: 'Sofía Marquesina' }),
    ).toContainText('Lista');
    await expect(
      contributions.getByRole('row').filter({ hasText: ACTORS.formatsTeacher.name }),
    ).toContainText('Sin aporte');

    await page.getByRole('button', { name: 'Enviar a coordinación' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enviar a coordinación' });
    await expect(dialog).toContainText('Andrés Peñaverde (sin aporte)');
    await dialog.getByRole('button', { name: 'Enviar ahora' }).click();
    await expect(statusBadge(page, 'Enviado · pendiente de revisión')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar a coordinación' })).toHaveCount(0);
  });

  test('el docente registra y envía una anotación del observador', async () => {
    const { page } = teacher;
    await page.goto('/docente/formatos');
    await page.getByRole('link', { name: /^Observador del estudiante/ }).click();
    await expect(page).toHaveURL(/\/docente\/formatos\/observador$/);
    await page.getByRole('link', { name: 'Nueva anotación' }).click();

    await page.getByLabel('Grado').selectOption({ label: '7° · Bachillerato' });
    await page.getByLabel('Estudiante (nombre de pila)').fill(FIRST_NAMES.note);
    await page.getByLabel('Tipo de anotación').selectOption({ label: 'Reconocimiento positivo' });
    await page.getByLabel('Comportamiento específico').fill(`${FIRST_NAMES.note}: ${NOTE}`);
    await page.getByLabel('Estrategias pedagógicas').fill('Diálogo y trabajo en pareja en clase.');
    await page.getByLabel('Resultados y compromisos').fill(COMMITMENT);
    await page.getByRole('button', { name: 'Guardar anotación' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: `Anotación de ${FIRST_NAMES.note}` }),
    ).toBeVisible();
    notePath = new URL(page.url()).pathname;

    await confirmSend(page);
  });

  test('coordinación devuelve el diario con una observación sobre la anotación', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion');
    await page.getByRole('link', { name: 'Formatos' }).first().click();
    // El hub cuenta los diarios enviados de sus grados: el demo trae uno de 7° y este recorrido, otro.
    await expect(
      page.getByRole('link', { name: /^Diarios de campo\b.*2 pendientes/ }),
    ).toBeVisible();
    await page.getByRole('link', { name: /^Diarios de campo\b/ }).click();
    await expect(page).toHaveURL(/\/coordinacion\/formatos\/diario$/);
    await page.getByRole('link', { name: `Revisar diario de 7° 1 del ${TODAY}` }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^7° 1 · / })).toBeVisible();
    reviewPath = new URL(page.url()).pathname;

    await expect(page.getByText(POSITIVE)).toBeVisible();
    await expect(page.getByText('Sin aporte', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Observar anotación de Matemáticas/ }).click();
    await page.getByLabel('Tu observación para Sofía Marquesina').fill(OBSERVATION);
    await page.getByRole('button', { name: 'Devolver con observaciones' }).click();
    await expect(page.getByText(/Devolviste el diario con 1 observación/)).toBeVisible();
    await expect(statusBadge(page, 'Con observaciones')).toBeVisible();
  });

  test('la docente corrige la anotación observada y el director reenvía el diario', async () => {
    const { page } = participant;
    await page.goto(journalPath);
    const card = page.getByRole('article', { name: 'Anotación de Matemáticas' });
    await expect(card).toContainText(OBSERVATION);
    await expect(card.getByText(/^Por corregir/)).toBeVisible();
    await card.getByRole('button', { name: /^Editar/ }).click();
    const form = page.getByRole('form', { name: 'Editar anotación' });
    await form.getByLabel('Descripción del evento').fill(`${FIRST_NAMES.positive}: ${CORRECTED}`);
    await form.getByRole('button', { name: 'Marcar como lista' }).click();
    await expect(page.getByRole('article', { name: 'Anotación de Matemáticas' })).toContainText(
      CORRECTED,
    );
    await expect(page.getByText(/^Lista · /)).toBeVisible();

    const director = teacher.page;
    await director.goto(journalPath);
    await director.getByRole('button', { name: 'Reenviar a coordinación' }).click();
    await director
      .getByRole('dialog', { name: 'Reenviar a coordinación' })
      .getByRole('button', { name: 'Reenviar ahora' })
      .click();
    await expect(statusBadge(director, 'Enviado · pendiente de revisión')).toBeVisible();
  });

  test('coordinación aprueba el diario con su firma', async () => {
    const { page } = coordinator;
    await page.goto(reviewPath);
    await expect(page.getByText(CORRECTED)).toBeVisible();
    await page.getByRole('button', { name: 'Aprobar y pasar al siguiente' }).click();
    // Pasa al siguiente pendiente (el del demo): el diario aprobado queda firmado.
    await expect(page).not.toHaveURL(new RegExp(`${reviewPath}$`));
    await page.goto(reviewPath);
    await expect(statusBadge(page, 'Revisado')).toBeVisible();
    await expect(page.getByText(`Revisado por: ${ACTORS.formatsCoordinator.name}`)).toBeVisible();
    await page.goto('/coordinacion/formatos');
    await expect(
      page.getByRole('link', { name: /^Diarios de campo\b.*1 pendiente\b/ }),
    ).toBeVisible();
  });

  test('coordinación revisa y aprueba la anotación del observador', async () => {
    const { page } = coordinator;
    await page.goto('/coordinacion/formatos');
    await page.getByRole('link', { name: /^Observadores\b/ }).click();
    await expect(page).toHaveURL(/\/coordinacion\/formatos\/observador$/);
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
    await expect(statusBadge(page, 'Revisado')).toBeVisible();
    await expect(page.getByText(ACTORS.formatsCoordinator.name).first()).toBeVisible();

    await page.goto(notePath);
    await expect(statusBadge(page, 'Revisada')).toBeVisible();
  });

  test('las rutas antiguas redirigen a las nuevas conservando la consulta', async () => {
    const cases: [ActorPage, string, RegExp][] = [
      [
        teacher,
        '/docente/formatos?pestana=observador&estado=borrador',
        /\/docente\/formatos\/observador\?.*estado=borrador/,
      ],
      [
        teacher,
        '/docente/formatos?estado=enviada',
        /\/docente\/formatos\/diario\?.*estado=enviada/,
      ],
      [
        teacher,
        '/docente/planeacion?pestana=repositorio',
        /\/docente\/formatos\/planeacion\?.*pestana=repositorio/,
      ],
      [
        teacher,
        '/docente/planeacion/nueva?actividad=abc',
        /\/docente\/formatos\/planeacion\/nueva\?.*actividad=abc/,
      ],
      [
        teacher,
        '/docente/planeacion/abc?paso=desempeno',
        /\/docente\/formatos\/planeacion\/abc\?.*paso=desempeno/,
      ],
      [
        coordinator,
        '/coordinacion/formatos?tipo=observador&estado=enviada',
        /\/coordinacion\/formatos\/observador\?.*estado=enviada/,
      ],
      [
        coordinator,
        '/coordinacion/formatos?tipo=diario',
        /\/coordinacion\/formatos\/diario\?.*tipo=diario/,
      ],
      [
        coordinator,
        '/coordinacion/planeaciones?status=enviada',
        /\/coordinacion\/formatos\/planeaciones\?.*status=enviada/,
      ],
      [
        coordinator,
        '/coordinacion/planeaciones/abc?status=enviada',
        /\/coordinacion\/formatos\/planeaciones\/abc\?.*status=enviada/,
      ],
    ];
    for (const [actor, from, expected] of cases) {
      await actor.page.goto(from);
      await expect(actor.page).toHaveURL(expected);
    }
  });
});

import type { INestApplication } from '@nestjs/common';
import {
  apiErrorBodySchema,
  ApiErrorCode,
  DigitalTool,
  LESSON_PLAN_MAX_RESOURCES,
  RecordStatus,
  UserRole,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  auditRows,
  createPlan,
  forceStatus,
  setupPlanning,
  type LessonPlanBody,
  type Planning,
} from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';

interface ResourceBody {
  id: string;
  tool: string;
  name: string | null;
  url: string;
  moment: number | null;
}

describe('recursos digitales de una planeación (BE-53)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coordinator: Cookies;
  let target: { gradeId: string; areaId: string };

  const as = (cookies: Cookies, method: 'get' | 'post' | 'delete', path: string) =>
    asUser(app, method, path, cookies, 'access');
  const plan = () => createPlan(app, teacher, { ...target, periodId: planning.periods[1] });
  const link = (overrides: Record<string, unknown> = {}) => ({
    tool: DigitalTool.Canva,
    name: 'Presentación',
    url: 'https://www.canva.com/design/abc',
    ...overrides,
  });
  const add = (cookies: Cookies, id: string, body: Record<string, unknown> = link()) =>
    as(cookies, 'post', `/lesson-plans/${id}/resources`).send(body);
  const detail = async (id: string) =>
    (await as(teacher, 'get', `/lesson-plans/${id}`).expect(200)).body as LessonPlanBody;
  const linkCount = (id: string) =>
    prisma.lessonPlanResource.count({ where: { lessonPlanId: id } });

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    target = await planning.gradeAndArea('Primaria');
    await planning.assign(teacherUser.id, target.gradeId, target.areaId);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  it('agrega enlaces de cada herramienta, con momento o general, y los devuelve en el detalle (R11)', async () => {
    const created = await plan();

    for (const [index, tool] of Object.values(DigitalTool).entries()) {
      const res = await add(
        teacher,
        created.id,
        link({ tool, name: `Enlace ${tool}`, moment: index % 2 === 0 ? (index % 4) + 1 : null }),
      ).expect(201);

      expect(res.body).toMatchObject({ tool, name: `Enlace ${tool}` });
    }

    const body = await detail(created.id);
    expect(body.linkedResources.map((r) => r.tool).sort()).toEqual(
      Object.values(DigitalTool).sort(),
    );
    // General primero, luego por momento.
    const moments = body.linkedResources.map((r) => r.moment ?? 0);
    expect(moments).toEqual([...moments].sort((a, b) => a - b));
  });

  it('guarda una fila de bitácora por alta con la lista de enlaces antes y después (R19)', async () => {
    const created = await plan();
    const res = await add(teacher, created.id, link({ moment: 2 })).expect(201);
    const resource = res.body as ResourceBody;

    const rows = await auditRows(app, created.id);
    expect(rows.at(-1)).toMatchObject({
      type: 'planeacion',
      action: 'Agregó un recurso digital a una planeación',
      entity: 'planeacion',
    });
    expect(rows.at(-1)?.dataBefore).toEqual({ linkedResources: [] });
    expect(rows.at(-1)?.dataAfter).toEqual({
      linkedResources: [
        { id: resource.id, tool: 'Canva', name: 'Presentación', url: link().url, moment: 2 },
      ],
    });
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,hola'],
    ['ftp://servidor.test/archivo'],
    ['/ruta/relativa'],
    ['canva.com/diseno'],
  ])('rechaza la URL «%s» con 400 en url (R12)', async (url) => {
    const created = await plan();

    const res = await add(teacher, created.id, link({ url })).expect(400);

    expect(apiErrorBodySchema.parse(res.body).errors?.map((e) => e.field)).toEqual(['url']);
    expect(await linkCount(created.id)).toBe(0);
  });

  it.each([0, 5, -1, 2.5])('rechaza el momento %s con 400 en moment (R12)', async (moment) => {
    const created = await plan();

    const res = await add(teacher, created.id, link({ moment })).expect(400);

    expect(apiErrorBodySchema.parse(res.body).errors?.map((e) => e.field)).toEqual(['moment']);
  });

  it('rechaza herramientas fuera de la lista, nombres vacíos y campos desconocidos (400)', async () => {
    const created = await plan();

    for (const body of [
      link({ tool: 'Genially' }),
      link({ name: '   ' }),
      link({ extra: true }),
      link({ url: 'http://' + 'a'.repeat(2050) + '.test' }),
    ]) {
      await add(teacher, created.id, body).expect(400);
    }
    expect(await linkCount(created.id)).toBe(0);
  });

  it('quita un enlace y deja de devolverlo; uno de otra planeación responde 404 (R13)', async () => {
    const created = await plan();
    const elsewhere = await plan();
    const first = (await add(teacher, created.id).expect(201)).body as ResourceBody;
    const second = (await add(teacher, created.id, link({ name: 'Otro' })).expect(201))
      .body as ResourceBody;
    const foreign = (await add(teacher, elsewhere.id).expect(201)).body as ResourceBody;

    await as(teacher, 'delete', `/lesson-plans/${created.id}/resources/${foreign.id}`).expect(404);
    await as(teacher, 'delete', `/lesson-plans/${created.id}/resources/${first.id}`).expect(204);

    expect((await detail(created.id)).linkedResources.map((r) => r.id)).toEqual([second.id]);
    expect((await detail(elsewhere.id)).linkedResources.map((r) => r.id)).toEqual([foreign.id]);
    const rows = await auditRows(app, created.id);
    expect(rows.at(-1)).toMatchObject({ action: 'Quitó un recurso digital de una planeación' });
    expect(rows.at(-1)?.dataBefore).toMatchObject({
      linkedResources: expect.arrayContaining([
        expect.objectContaining({ id: first.id }),
      ]) as unknown[],
    });
  });

  it('admite como máximo 30 enlaces y responde 409 al superarlos, también con altas simultáneas (R13)', async () => {
    const created = await plan();
    await prisma.lessonPlanResource.createMany({
      data: Array.from({ length: LESSON_PLAN_MAX_RESOURCES - 2 }, (_, index) => ({
        lessonPlanId: created.id,
        tool: 'Canva',
        name: `Enlace ${index}`,
        url: `https://recursos.ejemplo.test/${index}`,
      })),
    });

    const results = await Promise.all([1, 2, 3].map(() => add(teacher, created.id)));

    expect(results.map((res) => res.status).sort()).toEqual([201, 201, 409]);
    expect(await linkCount(created.id)).toBe(LESSON_PLAN_MAX_RESOURCES);
    await add(teacher, created.id).expect(409);
  });

  it('permite gestionar enlaces en observaciones y responde 409 en los demás estados (R5)', async () => {
    const created = await plan();
    const resource = (await add(teacher, created.id).expect(201)).body as ResourceBody;
    await forceStatus(app, created.id, RecordStatus.ChangesRequested);
    await add(teacher, created.id).expect(201);

    for (const status of [RecordStatus.Submitted, RecordStatus.Reviewed, RecordStatus.Voided]) {
      await forceStatus(app, created.id, status);

      await add(teacher, created.id).expect(409);
      await as(teacher, 'delete', `/lesson-plans/${created.id}/resources/${resource.id}`).expect(
        409,
      );
    }
    expect(await linkCount(created.id)).toBe(2);
  });

  it('una baja concurrente con una decisión no modifica la planeación ya revisada (R5)', async () => {
    const created = await plan();
    const resource = (await add(teacher, created.id).expect(201)).body as ResourceBody;
    const path = `/lesson-plans/${created.id}/resources/${resource.id}`;

    // Otra transacción retiene la fila de la planeación mientras llega la baja.
    let removal: Promise<number> | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM planeacion WHERE id = ${created.id}::uuid FOR UPDATE`;
      removal = Promise.resolve(as(teacher, 'delete', path)).then((res) => res.status);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await tx.lessonPlan.update({
        where: { id: created.id },
        data: { status: RecordStatus.Reviewed },
      });
    });

    expect(await removal).toBe(409);
    expect(await linkCount(created.id)).toBe(1);
  });

  it('coordinación recibe 403 y un docente ajeno 404 al agregar o quitar enlaces (R8)', async () => {
    const created = await plan();
    const resource = (await add(teacher, created.id).expect(201)).body as ResourceBody;
    const path = `/lesson-plans/${created.id}/resources`;

    const forbidden = await add(coordinator, created.id).expect(403);
    await as(coordinator, 'delete', `${path}/${resource.id}`).expect(403);
    await add(other, created.id).expect(404);
    await as(other, 'delete', `${path}/${resource.id}`).expect(404);

    expect(apiErrorBodySchema.parse(forbidden.body).code).toBe(ApiErrorCode.Forbidden);
    expect(await linkCount(created.id)).toBe(1);
  });
});

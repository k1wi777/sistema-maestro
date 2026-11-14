import type { INestApplication } from '@nestjs/common';
import {
  apiErrorBodySchema,
  RecordStatus,
  UserRole,
  type LessonPlan,
  type Page,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';

// La API serializa las fechas como texto ISO; en la prueba se lee el JSON tal cual.
type PlanBody = Omit<LessonPlan, 'submittedAt' | 'createdAt' | 'updatedAt'> & {
  submittedAt: string | null;
};
type PageBody = Omit<Page<PlanBody>, 'items'> & { items: PlanBody[] };

const { Draft, Submitted, ChangesRequested, Reviewed, Voided } = RecordStatus;

describe('bandeja de coordinación: listado de planeaciones (BE-55)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherA: TestUser;
  let teacherB: TestUser;
  let sessionA: Cookies;
  let sessionB: Cookies;
  let coordinator: Cookies;
  let admin: Cookies;
  // Cada prueba filtra por sus propios docentes, grados y áreas: la base se comparte con
  // otras suites en paralelo.
  let first: { gradeId: string; areaId: string };
  let second: { gradeId: string; areaId: string };
  const ids: Record<string, string> = {};

  const list = async (cookies: Cookies, query: string, status = 200): Promise<PageBody> => {
    const res = await asUser(app, 'get', `/lesson-plans?${query}`, cookies, 'access').expect(
      status,
    );
    return res.body as PageBody;
  };
  const idsOf = (page: PageBody) => page.items.map((item) => item.id);

  async function createPlan(
    teacherId: string,
    target: { gradeId: string; areaId: string },
    periodId: string,
    status: RecordStatus,
    submittedAt: Date | null,
  ): Promise<string> {
    const created = await prisma.lessonPlan.create({
      data: { teacherId, ...target, periodId, status, submittedAt },
    });
    return created.id;
  }

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherA = await createTestUser(app);
    teacherB = await createTestUser(app);
    sessionA = await signIn(app, teacherA);
    sessionB = await signIn(app, teacherB);
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    first = await planning.gradeAndArea('Primaria');
    second = await planning.gradeAndArea('Bachillerato');

    const day = (n: number) => new Date(`2031-03-0${n}T10:00:00Z`);
    ids.draft = await createPlan(teacherA.id, first, planning.periods[1], Draft, null);
    ids.sent = await createPlan(teacherA.id, first, planning.periods[1], Submitted, day(3));
    ids.returned = await createPlan(
      teacherA.id,
      first,
      planning.periods[2],
      ChangesRequested,
      day(1),
    );
    ids.reviewed = await createPlan(teacherA.id, second, planning.periods[2], Reviewed, day(2));
    ids.voided = await createPlan(teacherA.id, second, planning.periods[3], Voided, null);
    ids.other = await createPlan(teacherB.id, first, planning.periods[1], Submitted, day(4));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  it('coordinación y administración ven los borradores y las anuladas de todos los docentes (R1)', async () => {
    for (const cookies of [coordinator, admin]) {
      const page = await list(cookies, `teacherId=${teacherA.id}&pageSize=100`);

      expect(page).toMatchObject({ page: 1, pageSize: 100, totalItems: 5, totalPages: 1 });
      expect(new Set(idsOf(page))).toEqual(
        new Set([ids.draft, ids.sent, ids.returned, ids.reviewed, ids.voided]),
      );
    }
    const both = await list(coordinator, `gradeId=${first.gradeId}&pageSize=100`);
    expect(new Set(both.items.map((item) => item.teacher.id))).toEqual(
      new Set([teacherA.id, teacherB.id]),
    );
  });

  it('pagina con el contrato común (R1)', async () => {
    const page = await list(coordinator, `teacherId=${teacherA.id}&pageSize=2&page=3`);

    expect(page).toMatchObject({ page: 3, pageSize: 2, totalItems: 5, totalPages: 3 });
    expect(page.items).toHaveLength(1);
  });

  it('filtra por estado, grado, área, periodo y docente (R2)', async () => {
    const mine = `teacherId=${teacherA.id}`;

    expect(idsOf(await list(coordinator, `${mine}&status=${Draft}`))).toEqual([ids.draft]);
    expect(idsOf(await list(coordinator, `${mine}&status=${Voided}`))).toEqual([ids.voided]);
    expect(new Set(idsOf(await list(coordinator, `${mine}&gradeId=${second.gradeId}`)))).toEqual(
      new Set([ids.reviewed, ids.voided]),
    );
    expect(new Set(idsOf(await list(coordinator, `${mine}&areaId=${first.areaId}`)))).toEqual(
      new Set([ids.draft, ids.sent, ids.returned]),
    );
    expect(
      new Set(idsOf(await list(coordinator, `${mine}&periodId=${planning.periods[2]}`))),
    ).toEqual(new Set([ids.returned, ids.reviewed]));
    expect(idsOf(await list(coordinator, `teacherId=${teacherB.id}`))).toEqual([ids.other]);
  });

  it('combina los filtros entre sí (R2)', async () => {
    const page = await list(
      coordinator,
      [
        `teacherId=${teacherA.id}`,
        `gradeId=${first.gradeId}`,
        `areaId=${first.areaId}`,
        `periodId=${planning.periods[1]}`,
        `status=${Submitted}`,
      ].join('&'),
    );

    expect(idsOf(page)).toEqual([ids.sent]);
    expect(
      (
        await list(
          coordinator,
          `teacherId=${teacherA.id}&gradeId=${first.gradeId}&status=${Voided}`,
        )
      ).totalItems,
    ).toBe(0);
  });

  it('un valor sin coincidencias devuelve una página vacía, no un error (R2)', async () => {
    const unknown = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';
    for (const filter of ['gradeId', 'areaId', 'periodId', 'teacherId']) {
      const page = await list(coordinator, `${filter}=${unknown}`);
      expect(page).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
    }
  });

  it('rechaza ids con formato inválido y orden desconocido con 400 (R2)', async () => {
    for (const query of ['gradeId=x', 'areaId=x', 'teacherId=x', 'sortBy=topic']) {
      const body = apiErrorBodySchema.parse(await list(coordinator, query, 400));
      expect(body.statusCode).toBe(400);
    }
  });

  it('ordena por fecha de envío con las nunca enviadas al final en ambos sentidos (R3)', async () => {
    const mine = `teacherId=${teacherA.id}&sortBy=submittedAt`;

    const ascending = idsOf(await list(coordinator, `${mine}&sortOrder=asc`));
    const descending = idsOf(await list(coordinator, `${mine}&sortOrder=desc`));

    expect(ascending.slice(0, 3)).toEqual([ids.returned, ids.reviewed, ids.sent]);
    expect(descending.slice(0, 3)).toEqual([ids.sent, ids.reviewed, ids.returned]);
    for (const order of [ascending, descending]) {
      expect(new Set(order.slice(3))).toEqual(new Set([ids.draft, ids.voided]));
    }
  });

  it('ordena por fecha de creación y de actualización (R3)', async () => {
    const mine = `teacherId=${teacherA.id}`;

    const created = idsOf(await list(coordinator, `${mine}&sortBy=createdAt&sortOrder=asc`));
    const updated = idsOf(await list(coordinator, `${mine}&sortBy=updatedAt&sortOrder=desc`));

    expect(created).toEqual([ids.draft, ids.sent, ids.returned, ids.reviewed, ids.voided]);
    expect(updated).toEqual([ids.voided, ids.reviewed, ids.returned, ids.sent, ids.draft]);
  });

  it('un docente solo ve las suyas aunque filtre por otro docente (R4)', async () => {
    const own = await list(sessionB, `teacherId=${teacherA.id}`);
    expect(idsOf(own)).toEqual([ids.other]);

    const nothing = await list(sessionA, `teacherId=${teacherB.id}&status=${Draft}`);
    expect(idsOf(nothing)).toEqual([ids.draft]);

    const all = await list(sessionA, 'pageSize=100');
    expect(all.items.every((item) => item.teacher.id === teacherA.id)).toBe(true);
    expect(all.totalItems).toBe(5);
  });
});

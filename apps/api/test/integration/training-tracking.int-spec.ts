import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserRole, UserStatus, type PlanTracking, type TeacherTracking } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { asUser, createTestUser, serverOf, signIn, type Cookies } from './support/session';
import { buildModule, call, unique } from './support/training';
import {
  assignInYear,
  createPlanFor,
  newTeacher,
  useOwnCurrentYear,
  type OwnYear,
  type YearTeacher,
} from './support/training-year';

describe('seguimiento de la formación y exportación (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let year: OwnYear;
  let release: () => Promise<void>;
  let coord: Cookies;
  let coordId: string;

  // Escenario compartido (solo lectura en las pruebas): un área con dos módulos activos y uno en
  // borrador, un plan General con un módulo y docentes en cada situación.
  const F: Record<string, YearTeacher> = {};
  let areaPlanId: string;
  let generalPlanId: string;
  let areaModules: string[];
  let generalModule: string;
  let outsideAreaTeacher: YearTeacher;

  const mark = (t: YearTeacher, moduleId: string) =>
    call(app, t.cookies, 'post', `/me/training/modules/${moduleId}/video-viewed`);
  const planTracking = async (planId: string): Promise<PlanTracking> =>
    (await call(app, coord, 'get', `/training-tracking/plans/${planId}`).expect(200))
      .body as PlanTracking;
  const cellOf = (tracking: PlanTracking, teacher: YearTeacher, moduleId: string) =>
    tracking.teachers
      .find((row) => row.id === teacher.user.id)
      ?.modules.find((cell) => cell.moduleId === moduleId);
  const idsOf = (tracking: PlanTracking) => new Set(tracking.teachers.map((row) => row.id));

  beforeAll(async () => {
    release = await holdSchoolYearLock('exclusive');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    year = await useOwnCurrentYear(app);
    const coordinator = await createTestUser(app, { role: UserRole.Coordinator });
    coordId = coordinator.id;
    coord = await signIn(app, coordinator);

    const { gradeId, areaId } = await planning.gradeAndArea('Primaria');
    const other = await planning.gradeAndArea('Primaria');
    for (const name of ['a', 'f', 'withdrawn', 'unassigned']) {
      F[name] = await newTeacher(app);
    }
    outsideAreaTeacher = await newTeacher(app);
    F.inactive = {
      user: await createTestUser(app, { status: UserStatus.Inactive }),
      cookies: { access: '', refresh: '' },
    };
    for (const name of ['a', 'f', 'inactive']) {
      await assignInYear(app, (F[name] as YearTeacher).user.id, gradeId, areaId, year.code);
    }
    await assignInYear(
      app,
      (F.withdrawn as YearTeacher).user.id,
      gradeId,
      areaId,
      year.code,
      'retirada',
    );
    await assignInYear(app, outsideAreaTeacher.user.id, other.gradeId, other.areaId, year.code);

    const area = await createPlanFor(app, coord, year.code, areaId, `Plan del área ${unique()}`);
    areaPlanId = area.plan.id;
    areaModules = [
      (await buildModule(app, coord, area.section.id, { video: true })).id,
      // Con diapositivas: marcar solo el video deja el módulo «en curso».
      (await buildModule(app, coord, area.section.id, { video: true, slides: 1 })).id,
    ];
    await buildModule(app, coord, area.section.id, { video: true, publish: false });
    const general = await createPlanFor(app, coord, year.code, null, `General ${unique()}`);
    generalPlanId = general.plan.id;
    generalModule = (await buildModule(app, coord, general.section.id, { video: true })).id;

    // A termina el módulo 1 y empieza el 2; F termina el 1.
    await mark(F.a as YearTeacher, areaModules[0] as string).expect(200);
    await mark(F.a as YearTeacher, areaModules[1] as string).expect(200);
    await mark(F.f as YearTeacher, areaModules[0] as string).expect(200);
    await prisma.moduleProgress.updateMany({
      where: { teacherId: (F.a as YearTeacher).user.id, moduleId: areaModules[0] as string },
      data: { bestScore: 85 },
    });
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await year.restore();
    await app.close();
    await release();
  });

  describe('por plan (R21, R22)', () => {
    it('plan de área: solo los docentes activos con asignación activa en esa área y año', async () => {
      const tracking = await planTracking(areaPlanId);

      expect(idsOf(tracking)).toEqual(
        new Set([(F.a as YearTeacher).user.id, (F.f as YearTeacher).user.id]),
      );
      expect(tracking.plan).toMatchObject({
        id: areaPlanId,
        schoolYear: year.code,
        areaName: expect.any(String) as string,
      });
    });

    it('lista solo los módulos activos, en orden de sección y módulo, con sus totales por estado', async () => {
      const tracking = await planTracking(areaPlanId);

      expect(tracking.modules.map((module) => module.id)).toEqual(areaModules);
      expect(tracking.modules.map((module) => module.totals)).toEqual([
        { notStarted: 0, inProgress: 0, done: 2 },
        { notStarted: 1, inProgress: 1, done: 0 },
      ]);
      expect(tracking.modules[0]?.sectionTitle).toBe('Sección');
    });

    it('da el estado, la fecha de terminación y el mejor puntaje de cada docente y módulo', async () => {
      const tracking = await planTracking(areaPlanId);
      const a = F.a as YearTeacher;
      const f = F.f as YearTeacher;

      expect(cellOf(tracking, a, areaModules[0] as string)).toMatchObject({
        state: 'terminado',
        bestScore: 85,
        completedAt: expect.any(String) as string,
      });
      expect(cellOf(tracking, a, areaModules[1] as string)).toEqual({
        moduleId: areaModules[1],
        state: 'en_curso',
        completedAt: null,
        bestScore: null,
      });
      expect(cellOf(tracking, f, areaModules[1] as string)).toMatchObject({
        state: 'sin_iniciar',
        completedAt: null,
      });
    });

    it('plan General: todos los docentes activos, sin inactivos ni coordinación', async () => {
      const tracking = await planTracking(generalPlanId);
      const ids = idsOf(tracking);

      for (const name of ['a', 'f', 'withdrawn', 'unassigned']) {
        expect(ids.has((F[name] as YearTeacher).user.id)).toBe(true);
      }
      expect(ids.has(outsideAreaTeacher.user.id)).toBe(true);
      expect(ids.has((F.inactive as YearTeacher).user.id)).toBe(false);
      expect(ids.has(coordId)).toBe(false);
      expect(cellOf(tracking, F.unassigned as YearTeacher, generalModule)?.state).toBe(
        'sin_iniciar',
      );
      expect(tracking.teachers.map((row) => row.name)).toEqual(
        [...tracking.teachers.map((row) => row.name)].sort((a, b) => a.localeCompare(b, 'es')),
      );
    });

    it('un plan de otro año lectivo se devuelve sin docentes', async () => {
      const other = `${Number(year.code.slice(0, 4)) + 300}-${Number(year.code.slice(0, 4)) + 301}`;
      await prisma.schoolYear.createMany({ data: [{ code: other }], skipDuplicates: true });
      const { plan, section } = await createPlanFor(
        app,
        coord,
        other,
        null,
        `Otro año ${unique()}`,
      );
      await buildModule(app, coord, section.id, { video: true });

      const tracking = await planTracking(plan.id);

      expect(tracking.teachers).toEqual([]);
      expect(tracking.modules).toHaveLength(1);
      expect(tracking.modules[0]?.totals).toEqual({ notStarted: 0, inProgress: 0, done: 0 });
    });

    it('responde 404 para un plan que no existe y 400 para un id mal formado', async () => {
      await call(
        app,
        coord,
        'get',
        '/training-tracking/plans/00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await call(app, coord, 'get', '/training-tracking/plans/no-es-uuid').expect(400);
    });

    it('nunca incluye correos, URL firmadas, claves de objeto ni datos de estudiantes', async () => {
      const text = JSON.stringify(await planTracking(areaPlanId));

      expect(text).not.toMatch(/@|X-Amz|formacion\/modulos|certificados\/|https?:/);
    });
  });

  describe('por docente (R23)', () => {
    it('devuelve su avance por plan y módulo de su ruta y sus certificados', async () => {
      const a = F.a as YearTeacher;

      const res = await call(app, coord, 'get', `/training-tracking/teachers/${a.user.id}`).expect(
        200,
      );
      const tracking = res.body as TeacherTracking;

      expect(tracking.teacher).toEqual({ id: a.user.id, name: 'Usuario de prueba docente' });
      expect(tracking.schoolYear).toBe(year.code);
      const areaPlan = tracking.plans.find((plan) => plan.id === areaPlanId);
      expect(areaPlan?.modules.map((module) => [module.id, module.state])).toEqual([
        [areaModules[0], 'terminado'],
        [areaModules[1], 'en_curso'],
      ]);
      expect(areaPlan?.modules[0]).toMatchObject({ bestScore: 85, sectionTitle: 'Sección' });
      expect(tracking.plans.find((plan) => plan.id === generalPlanId)?.modules[0]?.state).toBe(
        'sin_iniciar',
      );
      expect(tracking.certificates).toHaveLength(1);
      expect(tracking.certificates[0]).toMatchObject({ kind: 'modulo' });
    });

    it('un docente sin áreas ve solo los planes General y ningún certificado', async () => {
      const u = F.unassigned as YearTeacher;

      const tracking = (
        await call(app, coord, 'get', `/training-tracking/teachers/${u.user.id}`).expect(200)
      ).body as TeacherTracking;

      expect(tracking.plans.map((plan) => plan.id)).toEqual([generalPlanId]);
      expect(tracking.certificates).toEqual([]);
    });

    it('responde 404 para un docente que no existe y 400 para un id mal formado', async () => {
      await call(
        app,
        coord,
        'get',
        '/training-tracking/teachers/00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await call(app, coord, 'get', '/training-tracking/teachers/no-es-uuid').expect(400);
    });
  });

  describe('permisos (R25)', () => {
    it('un docente recibe 403 y sin sesión 401 en todo el seguimiento', async () => {
      const t = F.unassigned as YearTeacher;
      const paths = [
        `/training-tracking/plans/${areaPlanId}`,
        `/training-tracking/plans/${areaPlanId}/export`,
        `/training-tracking/teachers/${t.user.id}`,
      ];

      for (const path of paths) {
        await call(app, t.cookies, 'get', path).expect(403);
        await request(serverOf(app)).get(path).expect(401);
      }
    });
  });

  describe('exportación CSV (R24, D5)', () => {
    const exportCsv = (planId: string) =>
      asUser(app, 'get', `/training-tracking/plans/${planId}/export`, coord, 'access')
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });

    it('entrega UTF-8 con BOM, separador «;», columnas fijas y una fila por docente y módulo', async () => {
      const res = await exportCsv(areaPlanId).expect(200);
      const bytes = res.body as Buffer;
      const lines = bytes
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .trimEnd()
        .split('\r\n');

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="seguimiento-plan-del-area-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(lines[0]).toBe(
        'Plan;Sección;Módulo;Docente;Estado;Fecha de terminación;Mejor puntaje (%);Certificado',
      );
      // 2 docentes del alcance × 2 módulos activos.
      expect(lines).toHaveLength(1 + 4);
      const a = lines.filter((line) => line.includes(';Terminado;') && line.includes(';85;sí'));
      expect(a).toHaveLength(1);
      expect(lines.filter((line) => line.endsWith(';sí')).length).toBe(2);
      expect(lines.filter((line) => line.endsWith(';no')).length).toBe(2);
      expect(lines.some((line) => line.includes(';En curso;'))).toBe(true);
      expect(lines.some((line) => line.includes(';Sin iniciar;'))).toBe(true);
    });

    it('neutraliza las celdas que empiezan por =, +, - o @ y no exporta correos, códigos ni claves', async () => {
      const a = F.a as YearTeacher;
      const original = 'Usuario de prueba docente';
      await prisma.user.update({
        where: { id: a.user.id },
        data: { fullName: '=HYPERLINK("http://x";"y")' },
      });
      try {
        const text = ((await exportCsv(areaPlanId).expect(200)).body as Buffer).toString('utf8');
        const code = (
          await prisma.certificate.findFirstOrThrow({ where: { teacherId: a.user.id } })
        ).code;

        expect(text).toContain(`"'=HYPERLINK(""http://x"";""y"")"`);
        expect(text).not.toMatch(/(^|;|\r\n)[=+\-@]/);
        expect(text).not.toContain('@sesion.test');
        expect(text).not.toContain(code);
        expect(text).not.toMatch(/X-Amz|formacion\/modulos|certificados\//);
      } finally {
        await prisma.user.update({ where: { id: a.user.id }, data: { fullName: original } });
      }
    });

    it('deja en la bitácora la exportación con el plan y el número de filas, sin su contenido', async () => {
      await exportCsv(areaPlanId).expect(200);

      const entry = await prisma.auditLog.findFirstOrThrow({
        where: {
          action: 'Exportó el seguimiento de la formación',
          entityId: areaPlanId,
          userId: coordId,
        },
        orderBy: { id: 'desc' },
      });

      expect(entry).toMatchObject({ type: 'formacion', entity: 'plan_formacion' });
      expect(entry.dataAfter).toMatchObject({ rows: 4 });
      expect(JSON.stringify(entry.dataAfter)).not.toMatch(/Usuario de prueba|@|Terminado/);
    });

    it('un plan sin docentes exporta solo los encabezados y uno inexistente es 404', async () => {
      const other = `${Number(year.code.slice(0, 4)) + 400}-${Number(year.code.slice(0, 4)) + 401}`;
      await prisma.schoolYear.createMany({ data: [{ code: other }], skipDuplicates: true });
      const { plan } = await createPlanFor(app, coord, other, null, `Vacío ${unique()}`);

      const res = await exportCsv(plan.id).expect(200);

      expect((res.body as Buffer).toString('utf8').trimEnd().split('\r\n')).toHaveLength(1);
      await call(
        app,
        coord,
        'get',
        '/training-tracking/plans/00000000-0000-4000-8000-000000000000/export',
      ).expect(404);
    });
  });
});

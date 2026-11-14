import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  UserRole,
  type CertificateList,
  type CertificateSummary,
  type CertificateVerification,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/shared/storage/object-storage';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, serverOf, signIn, type Cookies } from './support/session';
import { allMilestonesOf, buildModule, call, unique } from './support/training';
import {
  assignInYear,
  createPlanFor,
  newTeacher,
  useOwnCurrentYear,
  type OwnYear,
  type YearTeacher,
} from './support/training-year';

const CODE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

interface UrlResult {
  url: string;
  expiresAt: string;
}

describe('certificados verificables de la formación (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ObjectStorage;
  let planning: Planning;
  let year: OwnYear;
  let release: () => Promise<void>;
  let coord: Cookies;
  let coordId: string;

  interface Scenario extends YearTeacher {
    areaId: string;
    gradeId: string;
    planId: string;
    sectionId: string;
    moduleIds: string[];
  }

  /** Docente con su plan de área del año propio y módulos de solo video (un paso cada uno). */
  async function scenario(moduleCount = 2): Promise<Scenario> {
    const { gradeId, areaId } = await planning.gradeAndArea('Primaria');
    const teacher = await newTeacher(app);
    await assignInYear(app, teacher.user.id, gradeId, areaId, year.code);
    const { plan, section } = await createPlanFor(
      app,
      coord,
      year.code,
      areaId,
      `Plan ${unique()}`,
    );
    const moduleIds: string[] = [];
    for (let index = 0; index < moduleCount; index += 1) {
      moduleIds.push((await buildModule(app, coord, section.id, { video: true })).id);
    }
    return { ...teacher, areaId, gradeId, planId: plan.id, sectionId: section.id, moduleIds };
  }

  const finish = (s: YearTeacher, moduleId: string) =>
    call(app, s.cookies, 'post', `/me/training/modules/${moduleId}/video-viewed`);
  const mine = async (s: YearTeacher): Promise<CertificateSummary[]> =>
    (
      (await call(app, s.cookies, 'get', '/me/training/certificates').expect(200))
        .body as CertificateList
    ).items;
  const rows = (s: YearTeacher) =>
    prisma.certificate.findMany({ where: { teacherId: s.user.id }, orderBy: { issuedAt: 'asc' } });
  const verify = (code: string) => request(serverOf(app)).get(`/certificates/verify/${code}`);

  beforeAll(async () => {
    release = await holdSchoolYearLock('exclusive');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    planning = await setupPlanning(app);
    year = await useOwnCurrentYear(app);
    const coordinator = await createTestUser(app, { role: UserRole.Coordinator });
    coordId = coordinator.id;
    coord = await signIn(app, coordinator);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await year.restore();
    await app.close();
    await release();
  });

  describe('emisión (R12, R13, R14)', () => {
    it('terminar un módulo emite un certificado y una marca repetida no emite otro', async () => {
      const s = await scenario(2);

      const first = await finish(s, s.moduleIds[0] as string).expect(200);
      await finish(s, s.moduleIds[0] as string).expect(200);

      expect((first.body as { completedAt: string | null }).completedAt).not.toBeNull();
      const certificates = await rows(s);
      expect(certificates).toHaveLength(1);
      expect(certificates[0]).toMatchObject({
        moduleId: s.moduleIds[0],
        teacherName: 'Usuario de prueba docente',
        fileId: null,
      });
      expect(certificates[0]?.code).toMatch(CODE);
      expect(certificates[0]?.issuedAt.toISOString()).toBe(
        (first.body as { completedAt: string }).completedAt,
      );
      expect(await allMilestonesOf(app, s.user.id)).toEqual([
        'Vio el video',
        'Terminó un módulo',
        'Obtuvo un certificado',
      ]);
    });

    it('al terminar el último módulo de la ruta emite también el de ruta completa, una sola vez, y no se revoca', async () => {
      const s = await scenario(2);

      await finish(s, s.moduleIds[0] as string).expect(200);
      expect(await rows(s)).toHaveLength(1);
      await finish(s, s.moduleIds[1] as string).expect(200);

      const issued = await rows(s);
      expect(issued.map((row) => row.moduleId).sort()).toEqual([null, ...s.moduleIds].sort());
      const route = issued.find((row) => row.moduleId === null);
      expect(route).toMatchObject({ title: 'Ruta de formación GNS', planName: null });
      expect(new Set(issued.map((row) => row.code)).size).toBe(3);

      // Un módulo nuevo después tiene su propio certificado; el de ruta no se emite de nuevo.
      const added = await buildModule(app, coord, s.sectionId, { video: true });
      await finish(s, added.id).expect(200);
      const later = await rows(s);
      expect(later).toHaveLength(4);
      expect(later.filter((row) => row.moduleId === null)).toHaveLength(1);
    });

    it('no emite el de ruta mientras quede un módulo activo pendiente', async () => {
      const s = await scenario(3);

      await finish(s, s.moduleIds[0] as string).expect(200);
      await finish(s, s.moduleIds[1] as string).expect(200);

      expect((await rows(s)).filter((row) => row.moduleId === null)).toHaveLength(0);
      expect(await mine(s)).toHaveLength(2);
    });

    it('varias marcas simultáneas dejan un solo certificado de módulo y uno de ruta', async () => {
      const s = await scenario(1);

      await Promise.all([1, 2, 3].map(() => finish(s, s.moduleIds[0] as string)));

      const issued = await rows(s);
      expect(issued.filter((row) => row.moduleId === s.moduleIds[0])).toHaveLength(1);
      expect(issued.filter((row) => row.moduleId === null)).toHaveLength(1);
    });

    it('guarda una instantánea: renombrar al docente o al módulo no cambia el certificado', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const code = (await rows(s)).find((row) => row.moduleId !== null)?.code as string;

      await prisma.user.update({ where: { id: s.user.id }, data: { fullName: 'Nombre Nuevo' } });
      await prisma.trainingModule.update({
        where: { id: s.moduleIds[0] as string },
        data: { title: 'Título nuevo' },
      });
      const res = await verify(code).expect(200);

      expect(res.body).toMatchObject({
        teacherName: 'Usuario de prueba docente',
        kind: 'modulo',
      });
      expect((res.body as CertificateVerification).title).not.toBe('Título nuevo');
    });
  });

  describe('listado y descarga (R15 a R18)', () => {
    it('el docente lista solo los suyos y no ve los ajenos', async () => {
      const a = await scenario(1);
      const b = await scenario(1);
      await finish(a, a.moduleIds[0] as string).expect(200);
      await finish(b, b.moduleIds[0] as string).expect(200);

      const items = await mine(a);

      expect(items).toHaveLength(2);
      expect(items.map((item) => item.kind).sort()).toEqual(['modulo', 'ruta']);
      const ids = new Set((await rows(b)).map((row) => row.id));
      expect(items.some((item) => ids.has(item.id))).toBe(false);
      expect(Object.keys(items[0] ?? {}).sort()).toEqual(
        ['code', 'id', 'issuedAt', 'kind', 'planName', 'title'].sort(),
      );
    });

    it('genera el PDF en la primera descarga y lo reutiliza sin regenerar', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const certificate = (await mine(s)).find(
        (item) => item.kind === 'modulo',
      ) as CertificateSummary;
      const download = () =>
        call(app, s.cookies, 'post', `/me/training/certificates/${certificate.id}/download`);

      const first = (await download().expect(200)).body as UrlResult;
      const afterFirst = await prisma.certificate.findUniqueOrThrow({
        where: { id: certificate.id },
      });
      const second = (await download().expect(200)).body as UrlResult;
      const afterSecond = await prisma.certificate.findUniqueOrThrow({
        where: { id: certificate.id },
      });

      expect(afterFirst.fileId).not.toBeNull();
      expect(afterSecond.fileId).toBe(afterFirst.fileId);
      const key = `certificados/${certificate.id}.pdf`;
      expect(await prisma.storedFile.count({ where: { objectKey: key } })).toBe(1);
      expect(await storage.head(key)).toMatchObject({ contentType: 'application/pdf' });
      expect(Math.abs((Date.parse(first.expiresAt) - Date.now()) / 1000 - 300)).toBeLessThan(30);

      const file = await fetch(second.url);
      const bytes = Buffer.from(await file.arrayBuffer());
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('application/pdf');
      expect(file.headers.get('content-disposition')).toMatch(/^attachment/);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes.length).toBe((await storage.head(key))?.size);
      expect(await allMilestonesOf(app, s.user.id)).toEqual(
        expect.arrayContaining(['Descargó un certificado']),
      );
    });

    it('dos descargas simultáneas dejan un solo archivo registrado', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const certificate = (await mine(s)).find(
        (item) => item.kind === 'modulo',
      ) as CertificateSummary;

      const results = await Promise.all(
        [1, 2, 3].map(() =>
          call(app, s.cookies, 'post', `/me/training/certificates/${certificate.id}/download`),
        ),
      );

      expect(results.map((res) => res.status)).toEqual([200, 200, 200]);
      const key = `certificados/${certificate.id}.pdf`;
      expect(await prisma.storedFile.count({ where: { objectKey: key } })).toBe(1);
      const row = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
      expect(
        (await prisma.storedFile.findUniqueOrThrow({ where: { id: row.fileId as string } }))
          .objectKey,
      ).toBe(key);
    });

    it('un certificado ajeno o inexistente es 404 y no genera ningún archivo', async () => {
      const a = await scenario(1);
      const b = await scenario(1);
      await finish(a, a.moduleIds[0] as string).expect(200);
      const certificate = (await mine(a))[0] as CertificateSummary;

      await call(
        app,
        b.cookies,
        'post',
        `/me/training/certificates/${certificate.id}/download`,
      ).expect(404);
      await call(
        app,
        b.cookies,
        'post',
        '/me/training/certificates/00000000-0000-4000-8000-000000000000/download',
      ).expect(404);
      expect(
        await prisma.storedFile.count({
          where: { objectKey: `certificados/${certificate.id}.pdf` },
        }),
      ).toBe(0);
    });

    it('coordinación lista los certificados de un docente y descarga uno, con bitácora sin el código', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const certificate = (await mine(s)).find(
        (item) => item.kind === 'modulo',
      ) as CertificateSummary;

      const list = (
        await call(app, coord, 'get', `/training-certificates?teacherId=${s.user.id}`).expect(200)
      ).body as CertificateList;
      const download = await call(
        app,
        coord,
        'post',
        `/training-certificates/${certificate.id}/download`,
      ).expect(200);

      expect(list.items.map((item) => item.id)).toContain(certificate.id);
      expect(
        Buffer.from(await (await fetch((download.body as UrlResult).url)).arrayBuffer())
          .subarray(0, 5)
          .toString('latin1'),
      ).toBe('%PDF-');
      const audit = await prisma.auditLog.findMany({
        where: { entityId: certificate.id, entity: 'certificado' },
        orderBy: { id: 'asc' },
      });
      expect(audit.map((row) => [row.userId ?? '', row.action])).toEqual(
        expect.arrayContaining([
          [coordId, 'Descargó el certificado de un docente'],
          [s.user.id, 'Obtuvo un certificado'],
        ]),
      );
      const text = JSON.stringify(audit, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      expect(text).not.toContain(certificate.code);
      expect(text).not.toMatch(/X-Amz|certificados\//);
    });

    it('un docente recibe 403 en las rutas de coordinación y coordinación exige teacherId', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const certificate = (await mine(s))[0] as CertificateSummary;

      await call(app, s.cookies, 'get', `/training-certificates?teacherId=${s.user.id}`).expect(
        403,
      );
      await call(
        app,
        s.cookies,
        'post',
        `/training-certificates/${certificate.id}/download`,
      ).expect(403);
      await call(app, coord, 'get', '/training-certificates').expect(400);
      await call(app, coord, 'get', '/training-certificates?teacherId=no-es-uuid').expect(400);
    });
  });

  describe('verificación pública (R19, D1)', () => {
    it('confirma un código sin sesión con solo lo que muestra el PDF, aunque se escriba a mano', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const module = (await rows(s)).find((row) => row.moduleId !== null);
      const code = module?.code as string;

      const exact = await verify(code).expect(200);
      const loose = await verify(code.toLowerCase().replaceAll('-', '')).expect(200);

      expect(exact.body).toEqual({
        valid: true,
        teacherName: 'Usuario de prueba docente',
        kind: 'modulo',
        title: module?.title,
        planName: module?.planName,
        issuedAt: module?.issuedAt.toISOString(),
      });
      expect(loose.body).toEqual(exact.body);
    });

    it('un código inexistente, mal formado o raro es 404 igual, sin pistas ni bitácora', async () => {
      const before = await prisma.auditLog.count({ where: { action: 'Verificó un certificado' } });

      const bodies: unknown[] = [];
      for (const code of [
        'ZZZZ-ZZZZ-ZZZZ-ZZZZ',
        'ABCD',
        'ABCD-EFGH-JKMN-PQRU',
        '%27%20OR%201%3D1%20--',
        'a'.repeat(70),
      ]) {
        const res = await verify(code);
        expect(res.status).toBe(404);
        bodies.push((res.body as { message?: string }).message);
      }

      expect(await prisma.auditLog.count({ where: { action: 'Verificó un certificado' } })).toBe(
        before,
      );
      expect(new Set(bodies).size).toBe(1);
    });

    it('deja en la bitácora, sin usuario ni código, solo las verificaciones de códigos que existen', async () => {
      const s = await scenario(1);
      await finish(s, s.moduleIds[0] as string).expect(200);
      const module = (await rows(s)).find((row) => row.moduleId !== null);

      await verify(module?.code as string).expect(200);

      const entries = await prisma.auditLog.findMany({
        where: { action: 'Verificó un certificado', entityId: module?.id },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ userId: null, role: 'desconocido', type: 'formacion' });
      expect(JSON.stringify(entries[0]?.dataAfter)).not.toContain(module?.code as string);
    });
  });
});

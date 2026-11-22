import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { call } from './support/formats';
import {
  addAnnotation,
  annotationBody,
  annotationOf,
  journalWorld,
  markReady,
  startedJournal,
  submittedJournal,
  TODAY,
  useTodayYear,
  type Actor,
  type JournalBody,
} from './support/journal';
import { auditRows } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';

type Scope = {
  unrestricted: boolean;
  counts: { submitted: number; changesRequested: number; reviewed: number };
  grades: { id: string }[];
  groups: { id: string; gradeId: string }[];
};
type Page = {
  items: { id: string; status: string; reviewer: { id: string } | null }[];
  totalItems: number;
};

describe('revisión del diario de campo por coordinación (#107)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let release: () => Promise<void>;
  let restoreYear: () => Promise<void>;

  const get = (who: Actor, path: string) => call(app, who.cookies, 'get', path);
  const post = (who: Actor, path: string) => call(app, who.cookies, 'post', path);
  const detail = async (who: Actor, journalId: string) =>
    (await get(who, `/field-journals/${journalId}`).expect(200)).body as JournalBody;

  beforeAll(async () => {
    release = await holdSchoolYearLock('exclusive');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    restoreYear = await useTodayYear(app);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await restoreYear();
    await app.close();
    await release();
  });

  it('la coordinadora del grado ve el diario solo desde el primer envío; administración siempre (R12, P7)', async () => {
    const own = await journalWorld(app);
    const { journalId } = await startedJournal(app, own);

    await get(own.coordinator, `/field-journals/${journalId}`).expect(404);
    await detail(own.admin, journalId);
    const hidden = (await get(own.coordinator, '/field-journals?scope=review').expect(200))
      .body as Page;
    expect(hidden.items.map((item) => item.id)).not.toContain(journalId);

    await post(own.director, `/field-journals/${journalId}/submit`).expect(200);
    const seen = await detail(own.coordinator, journalId);
    // Nunca borradores ajenos: solo la anotación lista.
    expect(seen.annotations).toHaveLength(1);
    expect(seen.viewer).toMatchObject({ canReview: true, canSubmit: false, canAnnotate: false });
    const inbox = (await get(own.coordinator, '/field-journals?scope=review').expect(200))
      .body as Page;
    expect(inbox.items.map((item) => item.id)).toEqual([journalId]);
    // Otra coordinadora (de otro grado) no lo ve ni lo revisa.
    await get(own.otherCoordinator, `/field-journals/${journalId}`).expect(404);
    await post(own.otherCoordinator, `/field-journals/${journalId}/approve`).send({}).expect(403);
    const empty = (await get(own.otherCoordinator, '/field-journals?scope=review').expect(200))
      .body as Page;
    expect(empty.totalItems).toBe(0);
  });

  it('las cifras y el alcance de revisión de la coordinadora y de administración (R21)', async () => {
    const own = await journalWorld(app);
    await submittedJournal(app, own);
    const scope = (await get(own.coordinator, '/field-journals/review-scope').expect(200))
      .body as Scope;
    expect(scope).toMatchObject({
      unrestricted: false,
      counts: { submitted: 1, changesRequested: 0, reviewed: 0 },
    });
    expect(scope.grades.map((grade) => grade.id)).toEqual([own.gradeId]);
    expect(scope.groups).toEqual([
      expect.objectContaining({ id: own.groupId, gradeId: own.gradeId }),
    ]);

    const adminScope = (await get(own.admin, '/field-journals/review-scope').expect(200))
      .body as Scope;
    expect(adminScope.unrestricted).toBe(true);
    expect(adminScope.counts.submitted).toBeGreaterThanOrEqual(1);
    await get(own.director, '/field-journals/review-scope').expect(403);
  });

  it('devuelve con observaciones por anotación y general; solo los implicados las ven (R13, R17, P5)', async () => {
    const own = await journalWorld(app);
    const { journalId, anaAnnotationId } = await submittedJournal(app, own);

    const res = await post(own.coordinator, `/field-journals/${journalId}/return`)
      .send({
        comment: 'Revisen la redacción',
        observations: [{ annotationId: anaAnnotationId, text: 'Amplía la descripción' }],
      })
      .expect(200);
    const returned = res.body as JournalBody;
    expect(returned.status).toBe('observaciones');
    expect(annotationOf(returned, own.ana.user.id)).toMatchObject({
      status: 'observada',
      observation: { text: 'Amplía la descripción' },
    });
    expect(returned.generalObservation?.text).toBe('Revisen la redacción');

    // Autora y director(a) ven la observación; Luis (otro participante) no.
    const forAna = await detail(own.ana, journalId);
    expect(annotationOf(forAna, own.ana.user.id).observation?.text).toBe('Amplía la descripción');
    expect(forAna.generalObservation).toBeNull();
    const forDirector = await detail(own.director, journalId);
    expect(annotationOf(forDirector, own.ana.user.id).observation?.text).toBe(
      'Amplía la descripción',
    );
    expect(forDirector.generalObservation?.text).toBe('Revisen la redacción');
    expect(forDirector.viewer).toMatchObject({ canResubmit: false });
    const forLuis = await detail(own.luis, journalId);
    expect(forLuis.generalObservation).toBeNull();
    expect(forLuis.annotations.every((annotation) => annotation.observation === null)).toBe(true);
    const myList = (await get(own.ana, '/field-journals').expect(200)).body as {
      items: { id: string; myObservationCount: number }[];
    };
    expect(myList.items.find((item) => item.id === journalId)?.myObservationCount).toBe(1);

    // Solo la autora corrige; nadie agrega anotaciones; el reenvío espera la corrección.
    const base = `/field-journals/${journalId}/annotations/${anaAnnotationId}`;
    await call(app, own.luis.cookies, 'patch', base).send({ description: 'X' }).expect(403);
    await post(own.luis, '/field-journals/annotations')
      .send(annotationBody(own, own.areas.art))
      .expect(409);
    const blocked = await post(own.director, `/field-journals/${journalId}/resubmit`).expect(400);
    expect(JSON.stringify(blocked.body)).toContain('quedan anotaciones por corregir');

    await call(app, own.ana.cookies, 'patch', base)
      .send({ description: 'Descripción corregida' })
      .expect(200);
    await markReady(app, own.ana, journalId, anaAnnotationId);
    const resent = (await post(own.director, `/field-journals/${journalId}/resubmit`).expect(200))
      .body as JournalBody;
    expect(resent.status).toBe('enviado');
    expect(await prisma.fieldJournalSubmission.count({ where: { journalId } })).toBe(2);
    expect(resent.history.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['opened', 'ready', 'submitted', 'returned', 'resubmitted']),
    );

    const approved = (
      await post(own.coordinator, `/field-journals/${journalId}/approve`)
        .send({ comment: 'Gracias' })
        .expect(200)
    ).body as JournalBody;
    expect(approved.status).toBe('revisado');
    expect(approved.signature?.reviewer.id).toBe(own.coordinator.user.id);
    await post(own.coordinator, `/field-journals/${journalId}/approve`).send({}).expect(409);
    const done = (
      await get(own.coordinator, '/field-journals?scope=review&status=revisado').expect(200)
    ).body as Page;
    expect(done.items[0]).toMatchObject({
      id: journalId,
      reviewer: { id: own.coordinator.user.id },
    });
  });

  it('valida las observaciones: una anotación enviada del diario, sin repetir y al menos una (R13)', async () => {
    const own = await journalWorld(app);
    const { journalId, anaAnnotationId } = await submittedJournal(app, own);
    const luisDraft = await prisma.fieldJournalAnnotation.findFirstOrThrow({
      where: { journalId, teacherId: own.luis.user.id },
    });

    await post(own.coordinator, `/field-journals/${journalId}/return`).send({}).expect(400);
    const res = await post(own.coordinator, `/field-journals/${journalId}/return`)
      .send({ observations: [{ annotationId: luisDraft.id, text: 'No viajó' }] })
      .expect(400);
    expect(apiErrorBodySchema.parse(res.body).errors?.map((error) => error.field)).toEqual([
      'observations.0.annotationId',
    ]);
    await post(own.coordinator, `/field-journals/${journalId}/return`)
      .send({
        observations: [
          { annotationId: anaAnnotationId, text: 'Uno' },
          { annotationId: anaAnnotationId, text: 'Dos' },
        ],
      })
      .expect(400);
    // Solo comentario general: devuelve sin dejar anotaciones por corregir.
    const general = (
      await post(own.coordinator, `/field-journals/${journalId}/return`)
        .send({ comment: 'Ajusten la fecha' })
        .expect(200)
    ).body as JournalBody;
    expect(general.annotations.every((annotation) => annotation.status !== 'observada')).toBe(true);
    await post(own.director, `/field-journals/${journalId}/resubmit`).expect(200);
  });

  it('403 de autorrevisión al director(a) y a los autores de anotaciones enviadas (R15)', async () => {
    const own = await journalWorld(app);
    const { journalId } = await submittedJournal(app, own);
    // Administración que, además, dirige el grupo o anotó en él.
    for (const teacher of [own.director, own.ana]) {
      await prisma.user.update({ where: { id: teacher.user.id }, data: { role: 'administrador' } });
      const res = await post(teacher, `/field-journals/${journalId}/approve`).send({}).expect(403);
      expect(apiErrorBodySchema.parse(res.body).code).toBe('autorrevision_no_permitida');
      await prisma.user.update({ where: { id: teacher.user.id }, data: { role: 'docente' } });
    }
    expect((await detail(own.admin, journalId)).viewer.canReview).toBe(true);
    await post(own.admin, `/field-journals/${journalId}/approve`).send({}).expect(200);
  });

  it('un docente no revisa, y un diario sin enviar no se aprueba (409), tampoco la coordinadora', async () => {
    const own = await journalWorld(app);
    const { journalId } = await startedJournal(app, own);
    await post(own.ana, `/field-journals/${journalId}/approve`).send({}).expect(403);
    await post(own.admin, `/field-journals/${journalId}/approve`).send({}).expect(409);
    await post(own.coordinator, `/field-journals/${journalId}/approve`).send({}).expect(409);
  });

  it('la bitácora registra cada acción sin textos de anotaciones, observaciones ni nombres (R19)', async () => {
    const own = await journalWorld(app);
    const secret = `secreto-${Date.now()}`;
    const student = 'Zaphod';
    const created = await addAnnotation(
      app,
      own.ana,
      annotationBody(own, own.areas.math, {
        description: `${student}: ${secret}`,
      }),
    );
    const journalId = created.id!;
    const annotationId = annotationOf(created, own.ana.user.id).id;
    await markReady(app, own.ana, journalId, annotationId);
    await post(own.ana, `/field-journals/${journalId}/annotations/${annotationId}/draft`).expect(
      200,
    );
    await markReady(app, own.ana, journalId, annotationId);
    await post(own.director, `/field-journals/${journalId}/submit`).expect(200);
    await post(own.coordinator, `/field-journals/${journalId}/return`)
      .send({ comment: secret, observations: [{ annotationId, text: secret }] })
      .expect(200);
    await markReady(app, own.ana, journalId, annotationId);
    await post(own.director, `/field-journals/${journalId}/resubmit`).expect(200);
    await post(own.coordinator, `/field-journals/${journalId}/approve`)
      .send({ comment: secret })
      .expect(200);

    const rows = await auditRows(app, journalId);
    expect(rows.map((row) => row.action)).toEqual([
      'Agregó una anotación al diario de campo',
      'Marcó lista una anotación del diario de campo',
      'Volvió a borrador una anotación del diario de campo',
      'Marcó lista una anotación del diario de campo',
      'Envió el diario de campo a coordinación',
      'Dejó observaciones en un diario de campo',
      'Marcó lista una anotación del diario de campo',
      'Reenvió el diario de campo a coordinación',
      'Aprobó un diario de campo',
    ]);
    const text = JSON.stringify(rows.map((row) => [row.dataBefore, row.dataAfter, row.detail]));
    expect(text).not.toContain(secret);
    expect(text).not.toContain(student);
    expect(text).toContain('[oculto]');
    expect(rows.at(-1)?.detail).toBe(`${created.group.name} · ${TODAY} · 1 de 3 aportes`);
    // El contenido sí vive en las tablas del diario y en la decisión de coordinación.
    expect(await prisma.fieldJournalObservation.count({ where: { annotationId } })).toBe(1);
    expect(
      (await prisma.review.findMany({ where: { recordId: journalId } })).map(
        (review) => review.comment,
      ),
    ).toContain(secret);
  });

  it('administración revisa un diario de un grado sin coordinadora (P4)', async () => {
    const own = await journalWorld(app);
    await prisma.grade.update({ where: { id: own.gradeId }, data: { coordinatorId: null } });
    const { journalId } = await submittedJournal(app, own);
    await get(own.coordinator, `/field-journals/${journalId}`).expect(404);
    await post(own.coordinator, `/field-journals/${journalId}/approve`).send({}).expect(403);
    await post(own.admin, `/field-journals/${journalId}/approve`).send({}).expect(200);
  });
});

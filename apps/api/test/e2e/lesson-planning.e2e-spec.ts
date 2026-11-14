import { randomBytes } from 'node:crypto';
import {
  AuditLogType,
  RecordStatus,
  ReviewAction,
  UserRole,
  type LessonPlan,
  type Page,
  type Review,
} from '@gns/shared';
import { DEMO_LESSON_PLANS } from '../../prisma/seed/demo/demo.data.ts';
import {
  DemoWorld,
  findAssignment,
  type AssignmentIds,
  type DemoSession,
} from './support/demo-session';

// Actores: Sofía Marquesina (docente de 3° y 4°) y Elena Ravassa (coordinación). Sofía no tiene
// ninguna planeación demo de Matemáticas de 4°, así que el recorrido crea la suya sin chocar con
// los datos demo; Elena es la coordinadora de este recorrido y de el de formación (la otra
// coordinadora, Tomás, es la del recorrido de formatos).
const TEACHER = 'sofia.marquesina';
const COORDINATOR = 'elena.ravassa';

const marker = randomBytes(4).toString('hex');
const TOPIC = `Tema-${marker}`;
const PERFORMANCE = `Desempeno-${marker}`;
const DEVELOPMENT = `Desarrollo-${marker}`;
const OBSERVATION = `Observacion-${marker}`;
const CORRECTED = `Corregido-${marker}`;
const DIAGNOSIS = `Diagnostico-${marker}`;
const MARKERS = [TOPIC, PERFORMANCE, DEVELOPMENT, OBSERVATION, CORRECTED, DIAGNOSIS];

describe('punta a punta · planeación y revisión', () => {
  let world: DemoWorld;
  let teacher: DemoSession;
  let coordinator: DemoSession;
  let ids: AssignmentIds;
  let plan: LessonPlan;
  const errors: string[] = [];

  beforeAll(async () => {
    world = await DemoWorld.start();
    teacher = await world.signInAs(TEACHER);
    coordinator = await world.signInAs(COORDINATOR);
    ids = await findAssignment(teacher, '4°', 'Matemáticas', 1);
  });

  afterAll(async () => {
    await world.close();
  });

  const inbox = async (query: string): Promise<LessonPlan[]> =>
    (
      (await coordinator.call('get', `/lesson-plans?pageSize=100&${query}`).expect(200))
        .body as Page<LessonPlan>
    ).items;

  it('el docente crea la planeación y la envía', async () => {
    const created = await teacher
      .call('post', '/lesson-plans')
      .send({ ...ids, topic: TOPIC })
      .expect(201);
    plan = created.body as LessonPlan;
    expect(plan.status).toBe(RecordStatus.Draft);

    // Sin el contenido mínimo no se envía: el error no devuelve lo escrito por el docente.
    const rejected = await teacher.call('post', `/lesson-plans/${plan.id}/submit`).expect(400);
    errors.push(rejected.text);

    await teacher
      .call('patch', `/lesson-plans/${plan.id}`)
      .send({ expectedPerformance: PERFORMANCE, developmentMoment: DEVELOPMENT })
      .expect(200);
    const submitted = await teacher.call('post', `/lesson-plans/${plan.id}/submit`).expect(200);
    expect((submitted.body as LessonPlan).status).toBe(RecordStatus.Submitted);
  });

  it('coordinación la encuentra en la bandeja por estado, grado, área, periodo y docente', async () => {
    const filters = [
      `status=${RecordStatus.Submitted}`,
      `gradeId=${ids.gradeId}`,
      `areaId=${ids.areaId}`,
      `periodId=${ids.periodId}`,
      `teacherId=${teacher.id}`,
    ];
    for (const filter of filters) {
      expect((await inbox(filter)).map((item) => item.id)).toContain(plan.id);
    }
    const reviewed = await inbox(`status=${RecordStatus.Reviewed}&teacherId=${teacher.id}`);
    expect(reviewed.map((item) => item.id)).not.toContain(plan.id);
  });

  it('la bandeja muestra las planeaciones demo en cada estado', async () => {
    const statuses = new Set(DEMO_LESSON_PLANS.map((demo) => demo.status));
    expect(statuses.size).toBe(5);
    for (const status of statuses) {
      const topics = (await inbox(`status=${status}`)).map((item) => item.topic);
      for (const demo of DEMO_LESSON_PLANS.filter((item) => item.status === status)) {
        expect(topics).toContain(demo.topic);
      }
    }
  });

  it('coordinación la devuelve con observaciones y el docente la corrige y la reenvía', async () => {
    const returned = await coordinator
      .call('post', `/lesson-plans/${plan.id}/return`)
      .send({ comment: OBSERVATION })
      .expect(200);
    expect((returned.body as LessonPlan).status).toBe(RecordStatus.ChangesRequested);

    // Con observaciones vuelve a ser editable por su dueño.
    await teacher
      .call('patch', `/lesson-plans/${plan.id}`)
      .send({ developmentMoment: CORRECTED })
      .expect(200);
    const resubmitted = await teacher.call('post', `/lesson-plans/${plan.id}/submit`).expect(200);
    expect((resubmitted.body as LessonPlan).status).toBe(RecordStatus.Submitted);
  });

  it('coordinación la aprueba y queda revisada, con su historial', async () => {
    const approved = await coordinator
      .call('post', `/lesson-plans/${plan.id}/approve`)
      .send({})
      .expect(200);
    expect((approved.body as LessonPlan).status).toBe(RecordStatus.Reviewed);

    const reviews = (await teacher.call('get', `/lesson-plans/${plan.id}/reviews`).expect(200))
      .body as Review[];
    expect(reviews.map((review) => review.action)).toEqual([
      ReviewAction.ChangesRequested,
      ReviewAction.Approved,
    ]);
    expect(reviews[0]?.comment).toBe(OBSERVATION);
    const reviewed = await inbox(`status=${RecordStatus.Reviewed}&teacherId=${teacher.id}`);
    expect(reviewed.map((item) => item.id)).toContain(plan.id);
  });

  it('los errores no devuelven lo que escribió el docente', async () => {
    const invalid = await teacher
      .call('post', '/lesson-plans')
      .send({ ...ids, diagnosis: DIAGNOSIS })
      .expect(400);
    const forbidden = await teacher
      .call('post', `/lesson-plans/${plan.id}/approve`)
      .send({ comment: CORRECTED })
      .expect(403);
    errors.push(invalid.text, forbidden.text);

    world.expectNoSensitiveData(errors.join('\n'), MARKERS);
  });

  it('la bitácora registra el recorrido sin datos sensibles', async () => {
    const teacherRows = await world.auditRowsOf(coordinator, teacher.id);
    const coordinatorRows = await world.auditRowsOf(coordinator, coordinator.id);

    const planning = teacherRows.filter((row) => row.type === AuditLogType.LessonPlan);
    expect(planning.length).toBeGreaterThanOrEqual(4);
    expect(planning.every((row) => row.role === UserRole.Teacher)).toBe(true);
    expect(teacherRows.some((row) => row.type === AuditLogType.DataConsent)).toBe(true);
    expect(teacherRows.some((row) => row.type === AuditLogType.Login)).toBe(true);
    const reviews = coordinatorRows.filter((row) => row.type === AuditLogType.LessonPlan);
    expect(reviews.length).toBeGreaterThanOrEqual(2);
    expect(reviews.every((row) => row.role === UserRole.Coordinator)).toBe(true);

    // El listado y el CSV no llevan datos antes/después, así que no pueden traer el contenido de
    // la planeación; las filas y los detalles, ningún secreto. (El detalle sí guarda el contenido
    // de la planeación, que no incluye datos de menores: ver la lista de chequeo.)
    world.expectNoSensitiveData(JSON.stringify([...teacherRows, ...coordinatorRows]), MARKERS);
    world.expectNoSensitiveData(await world.auditCsvOf(coordinator, teacher.id), MARKERS);
    world.expectNoSensitiveData(await world.auditCsvOf(coordinator, coordinator.id), MARKERS);
    for (const row of [...planning, ...reviews]) {
      const detail = await coordinator.call('get', `/audit-log/${row.id}`).expect(200);
      world.expectNoSensitiveData(detail.text, []);
    }
  });
});

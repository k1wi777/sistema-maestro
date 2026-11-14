import { randomBytes } from 'node:crypto';
import {
  AuditLogType,
  JournalEventType,
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  UserRole,
  type FieldJournal,
  type FieldJournalSummary,
  type ObserverNote,
  type Page,
  type Review,
} from '@gns/shared';
import {
  DemoWorld,
  findAssignment,
  type AssignmentIds,
  type DemoSession,
} from './support/demo-session';

// Actores: Andrés Peñaverde (director de grupo de 7°, con la hoja demo del periodo 1: este
// recorrido abre la del periodo 2) y Tomás Aldaverde (la coordinadora del recorrido de
// planeación es Elena, así que las filas de bitácora de cada recorrido no se mezclan).
const TEACHER = 'andres.penaverde';
const COORDINATOR = 'tomas.aldaverde';

// Nombres de pila inventados que no están en los datos demo; los textos llevan un marcador único.
const STUDENT_A = 'Xiomaro';
const STUDENT_B = 'Tabarna';
const OBSERVED_STUDENT = 'Quirino';
const marker = randomBytes(4).toString('hex');
const DESCRIPTION = `Descripcion-${marker}`;
const ACTIONS = `Acciones-${marker}`;
const REFLECTION = `Reflexion-${marker}`;
const NOTE_TEXT = `Anotacion-${marker}`;
const OBSERVATION = `Observacion-${marker}`;
const CORRECTED = `Corregida-${marker}`;
const FAMILY_DATA = `Familiar-${marker}`;
const NAMES = [STUDENT_A, STUDENT_B, OBSERVED_STUDENT];
const MARKERS = [
  DESCRIPTION,
  ACTIONS,
  REFLECTION,
  NOTE_TEXT,
  OBSERVATION,
  CORRECTED,
  FAMILY_DATA,
  ...NAMES,
];

describe('punta a punta · diario de campo y observador del estudiante', () => {
  let world: DemoWorld;
  let teacher: DemoSession;
  let coordinator: DemoSession;
  let ids: AssignmentIds;
  let journal: FieldJournal;
  let note: ObserverNote;
  const errors: string[] = [];

  beforeAll(async () => {
    world = await DemoWorld.start();
    teacher = await world.signInAs(TEACHER);
    coordinator = await world.signInAs(COORDINATOR);
    ids = await findAssignment(teacher, '7°', 'Física', 2);
  });

  afterAll(async () => {
    await world.close();
  });

  it('el docente registra una hoja del diario con entradas por nombre de pila y la envía', async () => {
    const created = await teacher
      .call('post', '/field-journals')
      .send({ gradeId: ids.gradeId, periodId: ids.periodId })
      .expect(201);
    journal = created.body as FieldJournal;
    expect(journal.status).toBe(RecordStatus.Draft);

    await teacher
      .call('post', `/field-journals/${journal.id}/entries`)
      .send({
        date: '2026-10-13',
        lesson: 'Física',
        eventType: JournalEventType.Group,
        students: [STUDENT_A, STUDENT_B],
        description: DESCRIPTION,
      })
      .expect(201);
    const second = await teacher
      .call('post', `/field-journals/${journal.id}/entries`)
      .send({
        date: '2026-10-14',
        lesson: 'Física',
        eventType: JournalEventType.ToImprove,
        students: [STUDENT_A],
        description: DESCRIPTION,
        actions: ACTIONS,
        reflection: REFLECTION,
      })
      .expect(201);
    expect((second.body as FieldJournal).entries).toHaveLength(2);

    const submitted = await teacher
      .call('post', `/field-journals/${journal.id}/submit`)
      .expect(200);
    expect((submitted.body as FieldJournal).status).toBe(RecordStatus.Submitted);
  });

  it('un nombre que no es de pila se rechaza sin repetirlo en el error', async () => {
    const res = await teacher
      .call('post', `/field-journals/${journal.id}/entries`)
      .send({
        date: '2026-10-15',
        lesson: 'Física',
        eventType: JournalEventType.Group,
        students: [`${STUDENT_A} Apellido Segundo`],
        description: DESCRIPTION,
      })
      .expect(400);

    expect(res.text).not.toContain('Apellido');
    errors.push(res.text);
  });

  it('el docente registra una anotación del observador y la envía', async () => {
    const created = await teacher
      .call('post', '/observer-notes')
      .send({
        gradeId: ids.gradeId,
        studentFirstName: OBSERVED_STUDENT,
        date: '2026-10-14',
        type: ObserverNoteType.Positive,
        description: NOTE_TEXT,
      })
      .expect(201);
    note = created.body as ObserverNote;
    expect(note.status).toBe(RecordStatus.Draft);

    const submitted = await teacher.call('post', `/observer-notes/${note.id}/submit`).expect(200);
    expect((submitted.body as ObserverNote).status).toBe(RecordStatus.Submitted);
  });

  it('coordinación revisa el diario: lo devuelve, el docente lo corrige y lo aprueba', async () => {
    const pending = (
      await coordinator
        .call(
          'get',
          `/field-journals?status=${RecordStatus.Submitted}&teacherId=${teacher.id}&pageSize=100`,
        )
        .expect(200)
    ).body as Page<FieldJournalSummary>;
    expect(pending.items.map((item) => item.id)).toContain(journal.id);

    await coordinator
      .call('post', `/field-journals/${journal.id}/return`)
      .send({ comment: OBSERVATION })
      .expect(200);
    const entry = (
      (await teacher.call('get', `/field-journals/${journal.id}`).expect(200)).body as FieldJournal
    ).entries[0];
    await teacher
      .call('patch', `/field-journals/${journal.id}/entries/${entry?.id}`)
      .send({ description: CORRECTED })
      .expect(200);
    await teacher.call('post', `/field-journals/${journal.id}/submit`).expect(200);

    const approved = await coordinator
      .call('post', `/field-journals/${journal.id}/approve`)
      .send({})
      .expect(200);
    expect((approved.body as FieldJournal).status).toBe(RecordStatus.Reviewed);

    const reviews = (
      await coordinator.call('get', `/field-journals/${journal.id}/reviews`).expect(200)
    ).body as Review[];
    expect(reviews.map((review) => review.action)).toEqual([
      ReviewAction.ChangesRequested,
      ReviewAction.Approved,
    ]);
  });

  it('coordinación aprueba la anotación del observador', async () => {
    const pending = (
      await coordinator
        .call(
          'get',
          `/observer-notes?status=${RecordStatus.Submitted}&teacherId=${teacher.id}&pageSize=100`,
        )
        .expect(200)
    ).body as Page<ObserverNote>;
    expect(pending.items.map((item) => item.id)).toContain(note.id);

    const approved = await coordinator
      .call('post', `/observer-notes/${note.id}/approve`)
      .send({})
      .expect(200);
    expect((approved.body as ObserverNote).status).toBe(RecordStatus.Reviewed);
  });

  it('no se admiten otros datos del estudiante y el error no los repite', async () => {
    const res = await teacher
      .call('post', '/observer-notes')
      .send({
        gradeId: ids.gradeId,
        studentFirstName: OBSERVED_STUDENT,
        date: '2026-10-14',
        type: ObserverNoteType.Positive,
        description: NOTE_TEXT,
        guardianName: FAMILY_DATA,
      })
      .expect(400);
    const forbidden = await teacher
      .call('post', `/observer-notes/${note.id}/approve`)
      .send({ comment: CORRECTED })
      .expect(403);
    errors.push(res.text, forbidden.text);

    world.expectNoSensitiveData(errors.join('\n'), MARKERS);
  });

  it('la bitácora registra el recorrido sin nombres de estudiantes ni textos', async () => {
    const teacherRows = await world.auditRowsOf(coordinator, teacher.id);
    const coordinatorRows = await world.auditRowsOf(coordinator, coordinator.id);

    const journals = teacherRows.filter((row) => row.type === AuditLogType.FieldJournal);
    const notes = teacherRows.filter((row) => row.type === AuditLogType.ObserverNote);
    expect(journals.length).toBeGreaterThanOrEqual(6);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect([...journals, ...notes].every((row) => row.role === UserRole.Teacher)).toBe(true);
    const reviews = coordinatorRows.filter(
      (row) => row.type === AuditLogType.FieldJournal || row.type === AuditLogType.ObserverNote,
    );
    expect(reviews.length).toBeGreaterThanOrEqual(3);
    expect(reviews.every((row) => row.role === UserRole.Coordinator)).toBe(true);

    world.expectNoSensitiveData(JSON.stringify([...teacherRows, ...coordinatorRows]), MARKERS);
    world.expectNoSensitiveData(await world.auditCsvOf(coordinator, teacher.id), MARKERS);
    world.expectNoSensitiveData(await world.auditCsvOf(coordinator, coordinator.id), MARKERS);
    // El detalle trae los datos antes/después tal como se guardaron: los textos ya están ocultos.
    for (const row of [...journals, ...notes, ...reviews]) {
      const detail = await coordinator.call('get', `/audit-log/${row.id}`).expect(200);
      world.expectNoSensitiveData(detail.text, MARKERS);
    }
  });
});

import { randomBytes } from 'node:crypto';
import {
  AuditLogType,
  JournalStatus,
  ObserverNoteType,
  RecordStatus,
  UserRole,
  type FieldJournal,
  type FieldJournalSummary,
  type ObserverNote,
  type Page,
  type TodayJournals,
} from '@gns/shared';
import { todayInBogota } from '../../src/shared/time/bogota-time';
import {
  DemoWorld,
  findAssignment,
  type AssignmentIds,
  type DemoSession,
} from './support/demo-session';

// Actores: Andrés Peñaverde (director de grupo de 7° 1) y Sofía Marquesina (docente de matemáticas
// en 7° 1) escriben el diario de hoy, que ningún diario demo ocupa; Tomás Aldaverde, coordinador de
// 7°, lo revisa (la coordinadora del recorrido de planeación es Elena, así que las filas de
// bitácora de cada recorrido no se mezclan).
const TEACHER = 'andres.penaverde';
const PARTICIPANT = 'sofia.marquesina';
const COORDINATOR = 'tomas.aldaverde';

// Nombres de pila inventados que no están en los datos demo; los textos llevan un marcador único.
const STUDENT_A = 'Xiomaro';
const STUDENT_B = 'Tabarna';
const OBSERVED_STUDENT = 'Quirino';
const marker = randomBytes(4).toString('hex');
// La descripción del diario nombra al estudiante implicado (F-PA-05) y, si hay algo por mejorar, las acciones.
const DESCRIPTION = `Descripcion-${marker}: ${STUDENT_A} y ${STUDENT_B} trabajaron en equipo.`;
const IMPROVE_DESCRIPTION = `Mejorar-${marker}: ${STUDENT_A} llegó tarde. Acciones: hablar con la familia.`;
const NOTE_TEXT = `Anotacion-${marker}`;
const OBSERVATION = `Observacion-${marker}`;
const CORRECTED = `Corregida-${marker}`;
const FAMILY_DATA = `Familiar-${marker}`;
const NAMES = [STUDENT_A, STUDENT_B, OBSERVED_STUDENT];
const MARKERS = [
  DESCRIPTION,
  IMPROVE_DESCRIPTION,
  NOTE_TEXT,
  OBSERVATION,
  CORRECTED,
  FAMILY_DATA,
  ...NAMES,
];

describe('punta a punta · diario de campo y observador del estudiante', () => {
  let world: DemoWorld;
  let teacher: DemoSession;
  let participant: DemoSession;
  let coordinator: DemoSession;
  let ids: AssignmentIds;
  let journal: FieldJournal;
  let groupId: string;
  let physicsId: string;
  let mathId: string;
  let note: ObserverNote;
  const errors: string[] = [];

  beforeAll(async () => {
    world = await DemoWorld.start();
    teacher = await world.signInAs(TEACHER);
    participant = await world.signInAs(PARTICIPANT);
    coordinator = await world.signInAs(COORDINATOR);
    ids = await findAssignment(teacher, '7°', 'Física', 2);
    const today = (await teacher.call('get', '/field-journals/today').expect(200))
      .body as TodayJournals;
    const group = today.groups.find((entry) => entry.group.name === '7° 1');
    groupId = group?.group.id ?? '';
    physicsId = group?.areas.find((area) => area.name === 'Física')?.id ?? '';
    const sofia = (await participant.call('get', '/field-journals/today').expect(200))
      .body as TodayJournals;
    mathId =
      sofia.groups
        .find((entry) => entry.group.id === groupId)
        ?.areas.find((area) => area.name === 'Matemáticas')?.id ?? '';
  });

  afterAll(async () => {
    await world.close();
  });

  it('los docentes del grupo agregan sus anotaciones por nombre de pila y el director(a) envía el diario', async () => {
    expect([groupId, physicsId, mathId].every(Boolean)).toBe(true);
    const date = todayInBogota();
    const created = await participant
      .call('post', '/field-journals/annotations')
      .send({
        groupId,
        date,
        areaId: mathId,
        description: DESCRIPTION,
      })
      .expect(201);
    journal = created.body as FieldJournal;
    expect(journal.status).toBe(JournalStatus.InProgress);
    const sofiaAnnotation = journal.annotations[0];
    await participant
      .call('post', `/field-journals/${journal.id}/annotations/${sofiaAnnotation?.id}/ready`)
      .expect(200);

    const own = await teacher
      .call('post', '/field-journals/annotations')
      .send({
        groupId,
        date,
        areaId: physicsId,
        description: IMPROVE_DESCRIPTION,
      })
      .expect(201);
    const mine = (own.body as FieldJournal).annotations.find((annotation) => annotation.isMine);
    await teacher
      .call('post', `/field-journals/${journal.id}/annotations/${mine?.id}/ready`)
      .expect(200);

    // Quien no dirige el grupo no envía; el director(a) sí, con el n de m congelado.
    await participant.call('post', `/field-journals/${journal.id}/submit`).expect(403);
    const submitted = (
      await teacher.call('post', `/field-journals/${journal.id}/submit`).expect(200)
    ).body as FieldJournal;
    expect(submitted).toMatchObject({ status: JournalStatus.Submitted, readyCount: 2 });
    expect(submitted.expectedCount).toBe(2);
  });

  it('los campos retirados del formato (estudiantes, tipo de evento…) se rechazan sin repetirlos en el error', async () => {
    const res = await participant
      .call('post', '/field-journals/annotations')
      .send({
        groupId,
        date: todayInBogota(),
        areaId: mathId,
        eventType: 'grupo',
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

  it('coordinación revisa el diario: lo devuelve con una observación, la autora corrige, el director(a) reenvía y se aprueba', async () => {
    const pending = (
      await coordinator
        .call('get', `/field-journals?scope=review&status=${JournalStatus.Submitted}&pageSize=100`)
        .expect(200)
    ).body as Page<FieldJournalSummary>;
    expect(pending.items.map((item) => item.id)).toContain(journal.id);
    const sofiaAnnotation = journal.annotations[0];

    await coordinator
      .call('post', `/field-journals/${journal.id}/return`)
      .send({
        comment: OBSERVATION,
        observations: [{ annotationId: sofiaAnnotation?.id, text: OBSERVATION }],
      })
      .expect(200);
    await participant
      .call('patch', `/field-journals/${journal.id}/annotations/${sofiaAnnotation?.id}`)
      .send({ description: CORRECTED })
      .expect(200);
    await participant
      .call('post', `/field-journals/${journal.id}/annotations/${sofiaAnnotation?.id}/ready`)
      .expect(200);
    await teacher.call('post', `/field-journals/${journal.id}/resubmit`).expect(200);

    const approved = await coordinator
      .call('post', `/field-journals/${journal.id}/approve`)
      .send({})
      .expect(200);
    const reviewed = approved.body as FieldJournal;
    expect(reviewed.status).toBe(JournalStatus.Reviewed);
    expect(reviewed.signature?.reviewer.id).toBe(coordinator.id);
    expect(reviewed.history.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        'opened',
        'ready',
        'submitted',
        'returned',
        'resubmitted',
        'approved',
      ]),
    );
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
    expect(journals.length).toBeGreaterThanOrEqual(4);
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

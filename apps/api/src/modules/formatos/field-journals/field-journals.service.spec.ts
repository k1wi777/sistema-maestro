import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  RecordStatus,
  ReviewAction,
  UserRole,
  type FieldJournal,
  type FieldJournalEntry,
  type MyAssignments,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import type { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import type { FieldJournalRepository, JournalEntryContent } from './field-journal.repository';
import { FieldJournalsService } from './field-journals.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const COORD = '33333333-3333-4333-8333-333333333333';
const JOURNAL = '44444444-4444-4444-8444-444444444444';
const GRADE = '55555555-5555-4555-8555-555555555555';
const PERIOD = '66666666-6666-4666-8666-666666666666';
const E1 = '77777777-7777-4777-8777-777777777771';
const E2 = '77777777-7777-4777-8777-777777777772';
const FOREIGN = '88888888-8888-4888-8888-888888888888';

const asUser = (id: string, role: UserRole): RequestUser => ({ id, role, sessionId: id });
const owner = asUser(OWNER, UserRole.Teacher);
const other = asUser(OTHER, UserRole.Teacher);
const coordinator = asUser(COORD, UserRole.Coordinator);

const entry = (id: string, patch: Partial<FieldJournalEntry> = {}): FieldJournalEntry => ({
  id,
  date: '2031-03-10',
  lesson: 'Arte',
  eventType: 'grupo',
  students: ['Ana', 'Luis'],
  description: 'Texto original',
  actions: null,
  reflection: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...patch,
});

function setup(status: RecordStatus = RecordStatus.Draft, entries = [entry(E1), entry(E2)]) {
  const journal: FieldJournal = {
    id: JOURNAL,
    teacher: { id: OWNER, fullName: 'Docente' },
    grade: { id: GRADE, name: 'Quinto' },
    period: { id: PERIOD, number: 1, schoolYear: '2031-2032' },
    status,
    submittedAt: null,
    entryCount: entries.length,
    entries,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = {
    findById: jest.fn(() => Promise.resolve(journal)),
    findByKey: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve(journal)),
    lock: jest.fn(() => Promise.resolve()),
    updateIfStatus: jest.fn(() => Promise.resolve(true)),
    countEntries: jest.fn(() => Promise.resolve(journal.entries.length)),
    addEntry: jest.fn(() => Promise.resolve()),
    updateEntry: jest.fn<Promise<boolean>, [string, string, JournalEntryContent]>(() =>
      Promise.resolve(true),
    ),
    removeEntry: jest.fn(() => Promise.resolve(true)),
    touch: jest.fn(() => Promise.resolve()),
  };
  const inserted: { action: string; adjustedFields: string[]; changes: unknown }[] = [];
  const reviewRepository = {
    insert: jest.fn((review: (typeof inserted)[number]) => {
      inserted.push(review);
      return Promise.resolve();
    }),
    findByRecord: jest.fn(() => Promise.resolve([])),
  };
  const assignments = {
    listMine: jest.fn(() =>
      Promise.resolve({
        schoolYear: '2031-2032',
        grades: [{ grade: { id: GRADE } }],
      } as unknown as MyAssignments),
    ),
  };
  const periods = {
    find: jest.fn(() => Promise.resolve({ id: PERIOD, number: 1, schoolYear: '2031-2032' })),
  };
  const service = new FieldJournalsService(
    repository as unknown as FieldJournalRepository,
    assignments as unknown as TeacherAssignmentsService,
    periods as unknown as AcademicPeriodsService,
    new ReviewsService(reviewRepository),
  );
  return { service, repository, assignments, periods, inserted };
}

const entryInput = {
  date: '2031-03-11',
  lesson: 'Música',
  eventType: 'grupo' as const,
  description: 'Algo',
};

describe('FieldJournalsService · crear', () => {
  it('403 si el grado no es de una asignación activa, antes de mirar el periodo', async () => {
    const { service, periods } = setup();
    await expect(
      service.create(owner, { gradeId: FOREIGN, periodId: PERIOD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(periods.find).not.toHaveBeenCalled();
  });

  it('400 con el campo periodId si el periodo no existe o es de otro año', async () => {
    const { service, periods } = setup();
    periods.find.mockResolvedValueOnce(null as never);
    await expect(service.create(owner, { gradeId: GRADE, periodId: PERIOD })).rejects.toMatchObject(
      {
        fieldErrors: [{ field: 'periodId' }],
      },
    );
    periods.find.mockResolvedValueOnce({ id: PERIOD, number: 1, schoolYear: '2030-2031' });
    await expect(
      service.create(owner, { gradeId: GRADE, periodId: PERIOD }),
    ).rejects.toBeInstanceOf(RequestValidationException);
  });

  it('409 si ya existe una hoja, también anulada', async () => {
    const { service, repository } = setup();
    repository.findByKey.mockResolvedValueOnce({
      id: JOURNAL,
      status: RecordStatus.Voided,
    } as never);
    await expect(service.create(owner, { gradeId: GRADE, periodId: PERIOD })).rejects.toThrow(
      /anulada/,
    );
    repository.findByKey.mockResolvedValueOnce({
      id: JOURNAL,
      status: RecordStatus.Draft,
    } as never);
    await expect(
      service.create(owner, { gradeId: GRADE, periodId: PERIOD }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('crea con el docente de la sesión', async () => {
    const { service, repository } = setup();
    await service.create(owner, { gradeId: GRADE, periodId: PERIOD });
    expect(repository.create).toHaveBeenCalledWith({
      teacherId: OWNER,
      gradeId: GRADE,
      periodId: PERIOD,
    });
  });
});

describe('FieldJournalsService · entradas', () => {
  it('orden 404 → 403 → 409 → 400', async () => {
    const draft = setup();
    await expect(draft.service.addEntry(other, JOURNAL, entryInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(draft.service.addEntry(coordinator, JOURNAL, entryInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const submitted = setup(RecordStatus.Submitted);
    await expect(
      submitted.service.addEntry(owner, JOURNAL, { ...entryInput, eventType: 'mejorar' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      draft.service.addEntry(owner, JOURNAL, { ...entryInput, eventType: 'mejorar' }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'actions' }] });
    expect(draft.repository.addEntry).not.toHaveBeenCalled();
  });

  it('una entrada que no es de la hoja responde 404', async () => {
    const { service } = setup();
    await expect(
      service.updateEntry(owner, JOURNAL, FOREIGN, { lesson: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeEntry(owner, JOURNAL, FOREIGN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('la regla de «a mejorar» se evalúa sobre el valor resultante', async () => {
    const { service, repository } = setup(RecordStatus.Draft, [
      entry(E1, { eventType: 'mejorar', actions: 'Practicar' }),
    ]);
    await expect(service.updateEntry(owner, JOURNAL, E1, { actions: null })).rejects.toMatchObject({
      fieldErrors: [{ field: 'actions' }],
    });
    await service.updateEntry(owner, JOURNAL, E1, { eventType: 'grupo', actions: null });
    expect(repository.updateEntry).toHaveBeenCalledWith(JOURNAL, E1, {
      eventType: 'grupo',
      actions: null,
    });
    expect(repository.touch).toHaveBeenCalledWith(JOURNAL);
  });

  it('guarda los estudiantes unidos', async () => {
    const { service, repository } = setup();
    await service.addEntry(owner, JOURNAL, { ...entryInput, students: ['Ana', 'María José'] });
    expect(repository.addEntry).toHaveBeenCalledWith(
      JOURNAL,
      expect.objectContaining({ students: 'Ana, María José' }),
    );
  });
});

describe('FieldJournalsService · enviar y anular', () => {
  it('enviar sin entradas responde 400 con el campo entries, tras el 409', async () => {
    const empty = setup(RecordStatus.Draft, []);
    await expect(empty.service.submit(owner, JOURNAL)).rejects.toMatchObject({
      fieldErrors: [{ field: 'entries' }],
    });
    const reviewed = setup(RecordStatus.Reviewed, []);
    await expect(reviewed.service.submit(owner, JOURNAL)).rejects.toBeInstanceOf(ConflictException);
  });

  it('enviar fija el estado y la fecha de envío', async () => {
    const { service, repository } = setup();
    await service.submit(owner, JOURNAL);
    expect(repository.updateIfStatus).toHaveBeenCalledWith(
      JOURNAL,
      [RecordStatus.Draft, RecordStatus.ChangesRequested],
      { status: RecordStatus.Submitted, submittedAt: expect.any(Date) as Date },
    );
  });

  it('el dueño no anula una revisada, coordinación sí; un tercero no la ve', async () => {
    const { service, repository } = setup(RecordStatus.Reviewed);
    await expect(service.voidJournal(owner, JOURNAL)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.voidJournal(other, JOURNAL)).rejects.toBeInstanceOf(NotFoundException);
    await service.voidJournal(coordinator, JOURNAL);
    expect(repository.updateIfStatus).toHaveBeenCalledWith(
      JOURNAL,
      expect.arrayContaining([RecordStatus.Reviewed]),
      { status: RecordStatus.Voided },
    );
  });
});

describe('FieldJournalsService · revisión', () => {
  it('un coordinador dueño no puede revisar su hoja (403 antes del 409)', async () => {
    const { service, repository } = setup(RecordStatus.Draft);
    const self = asUser(OWNER, UserRole.Coordinator);
    await expect(service.approve(self, JOURNAL, {})).rejects.toMatchObject({ status: 403 });
    expect(repository.lock).not.toHaveBeenCalled();
  });

  it('solo se revisa una hoja enviada (409)', async () => {
    const { service } = setup(RecordStatus.Draft);
    await expect(service.approve(coordinator, JOURNAL, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('aprueba sin ajustes: solo la decisión', async () => {
    const { service, inserted, repository } = setup(RecordStatus.Submitted);
    await service.approve(coordinator, JOURNAL, { comment: 'Bien' });
    expect(inserted.map((row) => row.action)).toEqual([ReviewAction.Approved]);
    expect(repository.updateEntry).not.toHaveBeenCalled();
  });

  it('el ajuste de dos entradas se guarda con claves entradas.<id>.<columna>', async () => {
    const { service, inserted, repository } = setup(RecordStatus.Submitted);
    await service.returnJournal(coordinator, JOURNAL, {
      comment: 'Ajusté',
      changes: {
        entries: [
          { id: E1, description: 'Texto nuevo', students: ['Ana'] },
          { id: E2, lesson: 'Arte' },
        ],
      },
    });
    expect(inserted.map((row) => row.action)).toEqual([
      ReviewAction.Adjustment,
      ReviewAction.ChangesRequested,
    ]);
    expect([...(inserted[0]?.adjustedFields ?? [])].sort()).toEqual([
      `entradas.${E1}.descripcion`,
      `entradas.${E1}.estudiantes`,
    ]);
    expect(inserted[0]?.changes).toEqual(
      expect.arrayContaining([
        { field: `entradas.${E1}.descripcion`, before: 'Texto original', after: 'Texto nuevo' },
        { field: `entradas.${E1}.estudiantes`, before: 'Ana, Luis', after: 'Ana' },
      ]),
    );
    // E2 no cambia (misma clase): no hay ajuste ni UPDATE para esa entrada.
    expect(repository.updateEntry).toHaveBeenCalledTimes(1);
    expect(repository.updateEntry).toHaveBeenCalledWith(JOURNAL, E1, {
      description: 'Texto nuevo',
      students: 'Ana',
    });
    expect(JSON.stringify(inserted[0]?.changes)).not.toContain(E2);
  });

  it('una entrada ajena o ningún cambio efectivo responden 400 sin escribir nada', async () => {
    const { service, repository, inserted } = setup(RecordStatus.Submitted);
    await expect(
      service.approve(coordinator, JOURNAL, {
        changes: { entries: [{ id: FOREIGN, description: 'x' }] },
      }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'changes.entries.0.id' }] });
    await expect(
      service.approve(coordinator, JOURNAL, {
        changes: { entries: [{ id: E1, description: 'Texto original' }] },
      }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'changes' }] });
    await expect(
      service.approve(coordinator, JOURNAL, {
        changes: { entries: [{ id: E1, eventType: 'mejorar' }] },
      }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'changes.entries.0.actions' }] });
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
    expect(repository.updateEntry).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });
});

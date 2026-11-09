import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ObserverNoteType,
  RecordStatus,
  ReviewAction,
  UserRole,
  type ListQuery,
  type ObserverNote,
  type ObserverNoteFilters,
  type ObserverNoteSortField,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import type { GradesService } from '../../estructura/catalogs/grade/grades.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import type { ObserverNoteRepository } from './observer-note.repository';
import { ObserverNotesService } from './observer-notes.service';
import { splitPriorityWindow } from './observer-priority';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const COORD = '33333333-3333-4333-8333-333333333333';
const NOTE = '44444444-4444-4444-8444-444444444444';
const GRADE = '55555555-5555-4555-8555-555555555555';
const PERIOD = '66666666-6666-4666-8666-666666666666';

const asUser = (id: string, role: UserRole): RequestUser => ({ id, role, sessionId: id });
const owner = asUser(OWNER, UserRole.Teacher);
const other = asUser(OTHER, UserRole.Teacher);
const coordinator = asUser(COORD, UserRole.Coordinator);

function setup(status: RecordStatus = RecordStatus.Draft) {
  const note: ObserverNote = {
    id: NOTE,
    teacher: { id: OWNER, fullName: 'Docente' },
    grade: { id: GRADE, name: 'Quinto' },
    studentFirstName: 'Ana',
    date: '2031-03-10',
    type: ObserverNoteType.TypeI,
    description: 'Texto original',
    studentVersion: null,
    actions: null,
    familyInformed: false,
    followUp: null,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = {
    findById: jest.fn(() => Promise.resolve(note)),
    findPage: jest.fn(() => Promise.resolve({})),
    create: jest.fn(() => Promise.resolve(note)),
    lock: jest.fn(() => Promise.resolve()),
    updateIfStatus: jest.fn(() => Promise.resolve(true)),
  };
  const inserted: { action: string; adjustedFields: string[]; changes: unknown }[] = [];
  const reviewRepository = {
    insert: jest.fn((review: (typeof inserted)[number]) => {
      inserted.push(review);
      return Promise.resolve();
    }),
    findByRecord: jest.fn(() => Promise.resolve([])),
  };
  const grades = { find: jest.fn(() => Promise.resolve({ id: GRADE })) };
  const periods = {
    find: jest.fn(() =>
      Promise.resolve({ id: PERIOD, startDate: '2031-02-01', endDate: '2031-04-30' }),
    ),
  };
  const service = new ObserverNotesService(
    repository as unknown as ObserverNoteRepository,
    grades as unknown as GradesService,
    periods as unknown as AcademicPeriodsService,
    new ReviewsService(reviewRepository),
  );
  return { service, repository, grades, periods, inserted };
}

const input = {
  gradeId: GRADE,
  studentFirstName: 'Ana',
  date: '2031-03-10',
  type: ObserverNoteType.TypeII,
  description: 'Texto',
  familyInformed: false,
};

const query = (
  filters: ObserverNoteFilters = {},
): ListQuery<ObserverNoteFilters, ObserverNoteSortField> => ({
  page: 1,
  pageSize: 20,
  sort: { field: 'priority', order: 'desc' },
  filters,
});

describe('ObserverNotesService · crear y editar', () => {
  it('crea sobre cualquier grado existente, sin consultar asignaciones', async () => {
    const { service, repository } = setup();
    await service.create(owner, input);
    expect(repository.create).toHaveBeenCalledWith({ ...input, teacherId: OWNER });
  });

  it('400 con el campo gradeId si el grado no existe', async () => {
    const { service, grades, repository } = setup();
    grades.find.mockResolvedValueOnce(null as never);
    await expect(service.create(owner, input)).rejects.toMatchObject({
      fieldErrors: [{ field: 'gradeId' }],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('editar: 404 → 403 → 409', async () => {
    await expect(setup().service.update(other, NOTE, { type: 'tipo_iii' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      setup().service.update(coordinator, NOTE, { type: 'tipo_iii' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      setup(RecordStatus.Submitted).service.update(owner, NOTE, { type: 'tipo_iii' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('editar solo escribe los campos recibidos', async () => {
    const { service, repository } = setup(RecordStatus.ChangesRequested);
    await service.update(owner, NOTE, { description: 'Nuevo', followUp: null });
    expect(repository.updateIfStatus).toHaveBeenCalledWith(
      NOTE,
      [RecordStatus.Draft, RecordStatus.ChangesRequested],
      { description: 'Nuevo', followUp: null },
    );
  });
});

describe('ObserverNotesService · listado', () => {
  it('a un docente le fuerza su id y a coordinación le deja el filtro', async () => {
    const { service, repository } = setup();
    await service.list(owner, query({ teacherId: OTHER }));
    await service.list(coordinator, query({ teacherId: OTHER }));
    expect(repository.findPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filters: { teacherId: OWNER } }),
    );
    expect(repository.findPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filters: { teacherId: OTHER } }),
    );
  });

  it('traduce el periodo a sus fechas y responde 400 si no existe o no tiene fechas', async () => {
    const { service, repository, periods } = setup();
    await service.list(coordinator, query({ periodId: PERIOD }));
    expect(repository.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { dateFrom: '2031-02-01', dateTo: '2031-04-30' } }),
    );
    periods.find.mockResolvedValueOnce({ id: PERIOD, startDate: null, endDate: null } as never);
    await expect(service.list(coordinator, query({ periodId: PERIOD }))).rejects.toMatchObject({
      fieldErrors: [{ field: 'periodId' }],
    });
    periods.find.mockResolvedValueOnce(null as never);
    await expect(service.list(coordinator, query({ periodId: PERIOD }))).rejects.toMatchObject({
      fieldErrors: [{ field: 'periodId' }],
    });
  });
});

describe('ObserverNotesService · enviar, anular y revisar', () => {
  it('enviar pasa a enviada', async () => {
    const { service, repository } = setup();
    await service.submit(owner, NOTE);
    expect(repository.updateIfStatus).toHaveBeenCalledWith(NOTE, expect.any(Array), {
      status: RecordStatus.Submitted,
    });
  });

  it('anular: el dueño no puede una revisada, coordinación sí', async () => {
    const { service } = setup(RecordStatus.Reviewed);
    await expect(service.voidNote(owner, NOTE)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.voidNote(coordinator, NOTE)).resolves.toBeDefined();
  });

  it('autorrevisión 403 y solo se revisan las enviadas (409)', async () => {
    await expect(
      setup(RecordStatus.Submitted).service.approve(asUser(OWNER, UserRole.Coordinator), NOTE, {}),
    ).rejects.toMatchObject({ status: 403 });
    await expect(setup().service.approve(coordinator, NOTE, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('devolver con ajustes guarda antes y después de cada campo y aplica el cambio', async () => {
    const { service, repository, inserted } = setup(RecordStatus.Submitted);
    await service.returnNote(coordinator, NOTE, {
      comment: 'Reclasifiqué',
      changes: { type: ObserverNoteType.TypeII, description: 'Texto original' },
    });
    expect(inserted.map((row) => row.action)).toEqual([
      ReviewAction.Adjustment,
      ReviewAction.ChangesRequested,
    ]);
    expect(inserted[0]?.changes).toEqual([{ field: 'tipo', before: 'tipo_i', after: 'tipo_ii' }]);
    expect(repository.updateIfStatus).toHaveBeenCalledWith(NOTE, [RecordStatus.Submitted], {
      type: ObserverNoteType.TypeII,
      description: 'Texto original',
      status: RecordStatus.ChangesRequested,
    });
  });

  it('ajustes sin ningún cambio efectivo responden 400 sin escribir', async () => {
    const { service, repository } = setup(RecordStatus.Submitted);
    await expect(
      service.approve(coordinator, NOTE, { changes: { description: 'Texto original' } }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'changes' }] });
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
  });
});

describe('splitPriorityWindow', () => {
  const split = splitPriorityWindow;

  it('una página dentro del segmento prioritario no toca el resto', () => {
    expect(split(0, 10, 25)).toEqual({
      priority: { skip: 0, take: 10 },
      rest: { skip: 0, take: 0 },
    });
  });

  it('la página que cruza el borde toma el final de uno y el inicio del otro', () => {
    expect(split(20, 10, 25)).toEqual({
      priority: { skip: 20, take: 5 },
      rest: { skip: 0, take: 5 },
    });
  });

  it('la página que empieza justo en el borde cae entera en el resto', () => {
    expect(split(25, 10, 25)).toEqual({
      priority: { skip: 25, take: 0 },
      rest: { skip: 0, take: 10 },
    });
  });

  it('más allá del borde el resto se desplaza lo que sobra', () => {
    expect(split(40, 10, 25)).toEqual({
      priority: { skip: 25, take: 0 },
      rest: { skip: 15, take: 10 },
    });
  });

  it('sin prioritarias todo es resto; con solo prioritarias el resto queda vacío', () => {
    expect(split(10, 10, 0)).toEqual({
      priority: { skip: 0, take: 0 },
      rest: { skip: 10, take: 10 },
    });
    expect(split(0, 10, 3)).toEqual({
      priority: { skip: 0, take: 3 },
      rest: { skip: 0, take: 7 },
    });
  });

  it('las páginas consecutivas cubren cada fila una sola vez', () => {
    const total = 53;
    const priority = 17;
    const seen: number[] = [];
    for (let skip = 0; skip < total; skip += 10) {
      const { priority: p, rest: r } = split(skip, 10, priority);
      seen.push(
        ...Array.from({ length: p.take }, (_, i) => p.skip + i),
        ...Array.from({ length: r.take }, (_, i) => priority + r.skip + i),
      );
    }
    expect(seen.slice(0, total)).toEqual(Array.from({ length: total }, (_, i) => i));
  });
});

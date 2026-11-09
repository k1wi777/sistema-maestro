import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AreaType,
  TeacherAssignmentStatus,
  UserRole,
  UserStatus,
  type SchoolYear,
  type TeacherAssignment,
  type User,
} from '@gns/shared';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { UsersService } from '../../identidad/users/users.service';
import type { AreasService } from '../catalogs/area/areas.service';
import type { GradesService } from '../catalogs/grade/grades.service';
import type { SchoolYearsService } from '../school-years/school-years.service';
import { groupAssignmentsByGrade } from './my-assignments';
import type { TeacherAssignmentRepository } from './teacher-assignment.repository';
import { TeacherAssignmentsService } from './teacher-assignments.service';

const NOW = new Date('2026-11-09T00:00:00Z');
const YEAR = '2026-2027';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'teacher-1',
    fullName: 'Docente Uno',
    email: 'uno@gns.test',
    role: UserRole.Teacher,
    status: UserStatus.Active,
    createdById: null,
    createdAt: NOW,
    ...overrides,
  };
}

function assignment(overrides: Partial<TeacherAssignment> = {}): TeacherAssignment {
  return {
    id: 'a-1',
    schoolYear: YEAR,
    status: TeacherAssignmentStatus.Active,
    isHomeroomTeacher: false,
    teacher: { id: 'teacher-1', fullName: 'Docente Uno', status: UserStatus.Active },
    grade: { id: 'g-1', name: 'Primero', sortOrder: 5 },
    level: { id: 'l-1', name: 'Primaria' },
    area: { id: 'ar-1', name: 'Matemáticas', type: AreaType.Subject },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface Options {
  teacher?: User | null;
  grade?: boolean;
  area?: boolean;
  registeredYears?: string[];
  currentYear?: string | null;
  existing?: TeacherAssignment | null;
  homeroomOfAnother?: TeacherAssignment | null;
  stored?: TeacherAssignment | null;
  mine?: TeacherAssignment[];
}

function setup(options: Options = {}) {
  const repository = {
    findById: jest.fn(() => Promise.resolve(options.stored ?? null)),
    findPage: jest.fn(() =>
      Promise.resolve({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    ),
    findByNaturalKey: jest.fn(() => Promise.resolve(options.existing ?? null)),
    findHomeroomOfAnotherTeacher: jest.fn(() => Promise.resolve(options.homeroomOfAnother ?? null)),
    lockGrade: jest.fn(() => Promise.resolve()),
    findActiveByTeacher: jest.fn(() => Promise.resolve(options.mine ?? [])),
    create: jest.fn(() => Promise.resolve(assignment())),
    update: jest.fn((_id: string, changes: object) =>
      Promise.resolve({ ...(options.stored ?? assignment()), ...changes }),
    ),
  } satisfies TeacherAssignmentRepository;
  const users = {
    find: jest.fn(() => Promise.resolve(options.teacher === undefined ? user() : options.teacher)),
  } as unknown as UsersService;
  const grades = {
    find: jest.fn(() => Promise.resolve(options.grade === false ? null : { id: 'g-1' })),
  } as unknown as GradesService;
  const areas = {
    find: jest.fn(() => Promise.resolve(options.area === false ? null : { id: 'ar-1' })),
  } as unknown as AreasService;
  const currentYear = options.currentYear === undefined ? YEAR : options.currentYear;
  const schoolYears = {
    requireCurrent: jest.fn(() =>
      currentYear
        ? Promise.resolve({ code: currentYear } as SchoolYear)
        : Promise.reject(new ConflictException('sin vigente')),
    ),
    findByCode: jest.fn((code: string) =>
      Promise.resolve((options.registeredYears ?? [YEAR]).includes(code) ? { code } : null),
    ),
  } as unknown as SchoolYearsService;
  const transactions: TransactionRunner = { run: (fn) => fn() };
  const service = new TeacherAssignmentsService(
    repository,
    transactions,
    users,
    grades,
    areas,
    schoolYears,
  );
  return { service, repository };
}

const input = {
  teacherId: 'teacher-1',
  gradeId: 'g-1',
  areaId: 'ar-1',
  isHomeroomTeacher: false,
};

async function fieldOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(RequestValidationException);
  return (error as RequestValidationException).fieldErrors[0]?.field ?? '';
}

describe('TeacherAssignmentsService.create', () => {
  it('guarda con el año vigente si no se indica año', async () => {
    const { service, repository } = setup();

    await service.create(input);

    expect(repository.create).toHaveBeenCalledWith({ ...input, schoolYear: YEAR });
  });

  it('acepta un año registrado distinto del vigente', async () => {
    const { service, repository } = setup({ registeredYears: [YEAR, '2027-2028'] });

    await service.create({ ...input, schoolYear: '2027-2028' });

    expect(repository.create).toHaveBeenCalledWith({ ...input, schoolYear: '2027-2028' });
  });

  it('acepta al coordinador como docente asignable', async () => {
    const { service, repository } = setup({ teacher: user({ role: UserRole.Coordinator }) });

    await service.create(input);

    expect(repository.create).toHaveBeenCalled();
  });

  it.each([
    ['inexistente', null],
    ['inactivo', user({ status: UserStatus.Inactive })],
    ['administrador', user({ role: UserRole.Administrator })],
  ])('rechaza con 400 en teacherId a un docente %s', async (_label, teacher) => {
    const { service, repository } = setup({ teacher });

    expect(await fieldOf(service.create(input))).toBe('teacherId');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza con 400 un grado, un área o un año inexistentes', async () => {
    expect(await fieldOf(setup({ grade: false }).service.create(input))).toBe('gradeId');
    expect(await fieldOf(setup({ area: false }).service.create(input))).toBe('areaId');
    expect(await fieldOf(setup().service.create({ ...input, schoolYear: '2030-2031' }))).toBe(
      'schoolYear',
    );
  });

  it('responde 409 si no hay año vigente y no se indica año', async () => {
    const { service } = setup({ currentYear: null });

    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('responde 409 por duplicado y avisa si la existente está retirada', async () => {
    const active = setup({ existing: assignment() });
    const withdrawn = setup({
      existing: assignment({ id: 'old-1', status: TeacherAssignmentStatus.Withdrawn }),
    });

    await expect(active.service.create(input)).rejects.toThrow(/Ya existe una asignación con/);
    await expect(withdrawn.service.create(input)).rejects.toThrow(/retirada.*old-1.*reactívala/);
    expect(active.repository.create).not.toHaveBeenCalled();
  });

  it('responde 409 si otro docente ya dirige el grupo, tras bloquear el grado', async () => {
    const { service, repository } = setup({
      homeroomOfAnother: assignment({ id: 'other', isHomeroomTeacher: true }),
    });

    await expect(service.create({ ...input, isHomeroomTeacher: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.lockGrade).toHaveBeenCalledWith('g-1');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('no consulta la dirección de grupo si no se marca', async () => {
    const { service, repository } = setup();

    await service.create(input);

    expect(repository.lockGrade).not.toHaveBeenCalled();
  });
});

describe('TeacherAssignmentsService.update y setStatus', () => {
  it('responde 404 si la asignación no existe', async () => {
    const { service } = setup();

    await expect(service.update('x', { isHomeroomTeacher: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.setStatus('x', TeacherAssignmentStatus.Withdrawn)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza con 409 marcar la dirección si otro docente la tiene', async () => {
    const { service, repository } = setup({
      stored: assignment(),
      homeroomOfAnother: assignment({ id: 'other', isHomeroomTeacher: true }),
    });

    await expect(service.update('a-1', { isHomeroomTeacher: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('retira sin validar nada más y conserva el registro', async () => {
    const { service, repository } = setup({ stored: assignment({ isHomeroomTeacher: true }) });

    const result = await service.setStatus('a-1', TeacherAssignmentStatus.Withdrawn);

    expect(result.status).toBe(TeacherAssignmentStatus.Withdrawn);
    expect(repository.update).toHaveBeenCalledWith('a-1', { status: 'retirada' });
    expect(repository.findHomeroomOfAnotherTeacher).not.toHaveBeenCalled();
  });

  it('reactiva repitiendo las validaciones del docente y de la dirección', async () => {
    const stored = assignment({
      status: TeacherAssignmentStatus.Withdrawn,
      isHomeroomTeacher: true,
    });
    const inactive = setup({ stored, teacher: user({ status: UserStatus.Inactive }) });
    const taken = setup({
      stored,
      homeroomOfAnother: assignment({ id: 'other', isHomeroomTeacher: true }),
    });
    const free = setup({ stored });

    expect(await fieldOf(inactive.service.setStatus('a-1', TeacherAssignmentStatus.Active))).toBe(
      'teacherId',
    );
    await expect(
      taken.service.setStatus('a-1', TeacherAssignmentStatus.Active),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      free.service.setStatus('a-1', TeacherAssignmentStatus.Active),
    ).resolves.toMatchObject({ status: 'activa' });
  });

  it('es idempotente al repetir el estado actual', async () => {
    const { service, repository } = setup({ stored: assignment() });

    await service.setStatus('a-1', TeacherAssignmentStatus.Active);

    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe('TeacherAssignmentsService.list', () => {
  it('filtra por el año vigente si no se indica año', async () => {
    const { service, repository } = setup();

    await service.list({
      page: 1,
      pageSize: 20,
      sort: { field: 'createdAt', order: 'desc' },
      filters: { teacherId: 't' },
    });

    expect(repository.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { teacherId: 't', schoolYear: YEAR } }),
    );
  });

  it('responde 409 sin año vigente ni año explícito', async () => {
    const { service } = setup({ currentYear: null });

    await expect(
      service.list({
        page: 1,
        pageSize: 20,
        sort: { field: 'createdAt', order: 'desc' },
        filters: {},
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('mis asignaciones', () => {
  it('agrupa por grado, ordena y marca la dirección de grupo', async () => {
    const second = { id: 'g-2', name: 'Segundo', sortOrder: 6 };
    const { service } = setup({
      mine: [
        assignment({
          id: 'a-2',
          grade: second,
          area: { id: 'ar-9', name: 'Ética', type: AreaType.Subject },
        }),
        assignment({ id: 'a-3', area: { id: 'ar-3', name: 'Sociales', type: AreaType.Subject } }),
        assignment({ id: 'a-1', isHomeroomTeacher: true }),
      ],
    });

    const result = await service.listMine('teacher-1');

    expect(result.schoolYear).toBe(YEAR);
    expect(result.grades.map((g) => g.grade.name)).toEqual(['Primero', 'Segundo']);
    expect(result.grades[0]).toMatchObject({
      isHomeroomTeacher: true,
      level: { name: 'Primaria' },
    });
    expect(result.grades[0]?.areas.map((a) => a.name)).toEqual(['Matemáticas', 'Sociales']);
    expect(result.grades[1]?.isHomeroomTeacher).toBe(false);
  });

  it('sin asignaciones devuelve la lista vacía', async () => {
    const { service } = setup();

    await expect(service.listMine('teacher-1')).resolves.toEqual({ schoolYear: YEAR, grades: [] });
    expect(groupAssignmentsByGrade(YEAR, [])).toEqual({ schoolYear: YEAR, grades: [] });
  });

  it('responde 409 si no hay año vigente', async () => {
    const { service } = setup({ currentYear: null });

    await expect(service.listMine('teacher-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

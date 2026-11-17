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
import type { GroupsService } from '../catalogs/group/groups.service';
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
    group: { id: 'gr-1', name: 'Primero 1' },
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
  group?: 'missing' | 'inactive';
  grade?: 'inactive';
  area?: 'missing' | 'inactive' | 'other-level';
  registeredYears?: string[];
  currentYear?: string | null;
  existing?: TeacherAssignment | null;
  homeroomInGroup?: TeacherAssignment | null;
  hasOtherActive?: boolean;
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
    findHomeroomInGroup: jest.fn(() => Promise.resolve(options.homeroomInGroup ?? null)),
    lockGroup: jest.fn(() => Promise.resolve()),
    markOldestActiveAsHomeroom: jest.fn(() => Promise.resolve(options.hasOtherActive ?? false)),
    findActiveByTeacher: jest.fn(() => Promise.resolve(options.mine ?? [])),
    findActiveByYear: jest.fn(() => Promise.resolve(options.mine ?? [])),
    findActiveTeachers: jest.fn(() => Promise.resolve([{ id: 'teacher-1', fullName: 'Ana' }])),
    findGroupRoster: jest.fn(() => Promise.resolve(null)),
    findMyGroups: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve(assignment())),
    update: jest.fn((_id: string, changes: object) =>
      Promise.resolve({ ...(options.stored ?? assignment()), ...changes }),
    ),
  } satisfies TeacherAssignmentRepository;
  const users = {
    find: jest.fn(() => Promise.resolve(options.teacher === undefined ? user() : options.teacher)),
  } as unknown as UsersService;
  const groups = {
    find: jest.fn(() =>
      Promise.resolve(
        options.group === 'missing'
          ? null
          : { id: 'gr-1', gradeId: 'g-1', active: options.group !== 'inactive' },
      ),
    ),
  } as unknown as GroupsService;
  const grades = {
    find: jest.fn(() =>
      Promise.resolve({ id: 'g-1', levelId: 'l-1', active: options.grade !== 'inactive' }),
    ),
  } as unknown as GradesService;
  const areas = {
    find: jest.fn(() =>
      Promise.resolve(
        options.area === 'missing'
          ? null
          : {
              id: 'ar-1',
              active: options.area !== 'inactive',
              levelIds: options.area === 'other-level' ? ['l-2'] : ['l-1'],
            },
      ),
    ),
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
    groups,
    grades,
    areas,
    schoolYears,
  );
  return { service, repository };
}

const input = {
  teacherId: 'teacher-1',
  groupId: 'gr-1',
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

  it('rechaza con 400 un grupo, un área o un año inexistentes', async () => {
    expect(await fieldOf(setup({ group: 'missing' }).service.create(input))).toBe('groupId');
    expect(await fieldOf(setup({ area: 'missing' }).service.create(input))).toBe('areaId');
    expect(await fieldOf(setup().service.create({ ...input, schoolYear: '2030-2031' }))).toBe(
      'schoolYear',
    );
  });

  it.each([
    ['un grupo inactivo', { group: 'inactive' }, 'groupId', /grupo está inactivo/],
    ['un grado inactivo', { grade: 'inactive' }, 'groupId', /grado está inactivo/],
    ['un área inactiva', { area: 'inactive' }, 'areaId', /área está inactiva/],
    ['un área de otro nivel', { area: 'other-level' }, 'areaId', /no pertenece al nivel/],
  ] as const)('rechaza con 400 %s', async (_label, options, field, reason) => {
    const { service, repository } = setup(options);

    const error = await service.create(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RequestValidationException);
    const [first] = (error as RequestValidationException).fieldErrors;
    expect(first?.field).toBe(field);
    expect(first?.reason).toMatch(reason);
    expect(repository.create).not.toHaveBeenCalled();
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

  it('responde 409 con el nombre si el grupo ya tiene director(a), tras bloquear el grupo', async () => {
    const { service, repository } = setup({
      homeroomInGroup: assignment({
        id: 'other',
        isHomeroomTeacher: true,
        teacher: { id: 'teacher-2', fullName: 'Docente Dos', status: UserStatus.Active },
      }),
    });

    await expect(service.create({ ...input, isHomeroomTeacher: true })).rejects.toThrow(
      /Primero 1 ya tiene director\(a\) de grupo: Docente Dos/,
    );
    expect(repository.lockGroup).toHaveBeenCalledWith('gr-1');
    expect(repository.findHomeroomInGroup).toHaveBeenCalledWith('gr-1', YEAR, null);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('no consulta la dirección de grupo si no se marca', async () => {
    const { service, repository } = setup();

    await service.create(input);

    expect(repository.lockGroup).not.toHaveBeenCalled();
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

  it('rechaza con 409 marcar la dirección si el grupo ya la tiene (de cualquier docente)', async () => {
    const { service, repository } = setup({
      stored: assignment(),
      homeroomInGroup: assignment({ id: 'other', isHomeroomTeacher: true }),
    });

    await expect(service.update('a-1', { isHomeroomTeacher: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.findHomeroomInGroup).toHaveBeenCalledWith('gr-1', YEAR, 'a-1');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('retira sin validar nada más y conserva el registro', async () => {
    const { service, repository } = setup({ stored: assignment() });

    const result = await service.setStatus('a-1', TeacherAssignmentStatus.Withdrawn);

    expect(result.status).toBe(TeacherAssignmentStatus.Withdrawn);
    expect(repository.update).toHaveBeenCalledWith('a-1', { status: 'retirada' });
    expect(repository.findHomeroomInGroup).not.toHaveBeenCalled();
    expect(repository.markOldestActiveAsHomeroom).not.toHaveBeenCalled();
  });

  it('al retirar la fila con la dirección de grupo quita la marca y la traslada al mismo docente', async () => {
    const { service, repository } = setup({
      stored: assignment({ isHomeroomTeacher: true }),
      hasOtherActive: true,
    });

    const result = await service.setStatus('a-1', TeacherAssignmentStatus.Withdrawn);

    expect(result).toMatchObject({ status: 'retirada', isHomeroomTeacher: false });
    expect(repository.lockGroup).toHaveBeenCalledWith('gr-1');
    expect(repository.update).toHaveBeenCalledWith('a-1', {
      status: 'retirada',
      isHomeroomTeacher: false,
    });
    expect(repository.markOldestActiveAsHomeroom).toHaveBeenCalledWith('teacher-1', 'gr-1', YEAR);
  });

  it('reactivar repite las validaciones del grupo y del área', async () => {
    const stored = assignment({ status: TeacherAssignmentStatus.Withdrawn });

    const inactiveGroup = setup({ stored, group: 'inactive' });
    const inactiveArea = setup({ stored, area: 'inactive' });

    expect(
      await fieldOf(inactiveGroup.service.setStatus('a-1', TeacherAssignmentStatus.Active)),
    ).toBe('groupId');
    expect(
      await fieldOf(inactiveArea.service.setStatus('a-1', TeacherAssignmentStatus.Active)),
    ).toBe('areaId');
    expect(inactiveGroup.repository.update).not.toHaveBeenCalled();
  });

  it('reactiva repitiendo las validaciones del docente y de la dirección', async () => {
    const stored = assignment({
      status: TeacherAssignmentStatus.Withdrawn,
      isHomeroomTeacher: true,
    });
    const inactive = setup({ stored, teacher: user({ status: UserStatus.Inactive }) });
    const taken = setup({
      stored,
      homeroomInGroup: assignment({ id: 'other', isHomeroomTeacher: true }),
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
  it('muestra una sola vez el área que el docente tiene en varios grupos del grado', async () => {
    const { service } = setup({
      mine: [
        assignment({ id: 'a-1', group: { id: 'gr-10', name: 'Primero 10' } }),
        assignment({
          id: 'a-2',
          group: { id: 'gr-2', name: 'Primero 2' },
          isHomeroomTeacher: true,
        }),
        assignment({ id: 'a-3', group: { id: 'gr-1', name: 'Primero 1' } }),
      ],
    });

    const [grade] = (await service.listMine('teacher-1')).grades;

    expect(grade?.areas).toEqual([{ id: 'ar-1', name: 'Matemáticas', type: 'asignatura' }]);
    expect(grade?.groups).toEqual([
      { id: 'gr-1', name: 'Primero 1', isHomeroomTeacher: false },
      { id: 'gr-2', name: 'Primero 2', isHomeroomTeacher: true },
      { id: 'gr-10', name: 'Primero 10', isHomeroomTeacher: false },
    ]);
    expect(grade?.isHomeroomTeacher).toBe(true);
  });

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

describe('TeacherAssignmentsService.listActive', () => {
  it('delega en el repository con el año recibido, sin paginar', async () => {
    const mine = [assignment()];
    const { service, repository } = setup({ mine });

    await expect(service.listActive('2027-2028')).resolves.toEqual(mine);
    expect(repository.findActiveByYear).toHaveBeenCalledWith('2027-2028');
  });
});

describe('TeacherAssignmentsService.teachersInScope', () => {
  it('delegates to the repository and only returns id and name', async () => {
    const { service, repository } = setup();

    await expect(service.teachersInScope('ar-1', YEAR)).resolves.toEqual([
      { id: 'teacher-1', fullName: 'Ana' },
    ]);
    expect(repository.findActiveTeachers).toHaveBeenCalledWith('ar-1', YEAR);
    await service.teachersInScope(null, YEAR);
    expect(repository.findActiveTeachers).toHaveBeenLastCalledWith(null, YEAR);
  });
});

describe('TeacherAssignmentsService.groupRoster y myGroups', () => {
  it('delegan en el repository con el año pedido', async () => {
    const { service, repository } = setup();

    await expect(service.groupRoster('gr-1', YEAR)).resolves.toBeNull();
    expect(repository.findGroupRoster).toHaveBeenCalledWith('gr-1', YEAR);
    await expect(service.myGroups('teacher-1', YEAR)).resolves.toEqual([]);
    expect(repository.findMyGroups).toHaveBeenCalledWith('teacher-1', YEAR);
  });
});

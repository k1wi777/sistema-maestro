import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiErrorCode, UserRole, UserStatus, type Area, type Grade, type Group } from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { UsersService } from '../../identidad/users/users.service';
import { AreasService } from './area/areas.service';
import type { AreaRepository } from './area/area.repository';
import type { CatalogUsageRepository } from './catalog-usage.repository';
import type { GradeRepository } from './grade/grade.repository';
import { GradesService } from './grade/grades.service';
import type { GroupRepository } from './group/group.repository';
import { GroupsService } from './group/groups.service';
import type { LevelsService } from './level/levels.service';

const NOW = new Date('2026-11-09T00:00:00Z');

const grade = (overrides: Partial<Grade> = {}): Grade => ({
  id: 'g-1',
  levelId: 'l-1',
  name: 'Kinder',
  sortOrder: 1,
  active: true,
  coordinatorId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
const group = (overrides: Partial<Group> = {}): Group => ({
  id: 'gr-1',
  gradeId: 'g-1',
  name: 'Kinder 1',
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
const area = (overrides: Partial<Area> = {}): Area => ({
  id: 'a-1',
  name: 'Danza',
  type: 'asignatura',
  active: true,
  levelIds: ['l-1'],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

function usage(counts: { group?: number; grade?: number; area?: number } = {}) {
  return {
    countGroup: jest.fn(() => Promise.resolve(counts.group ?? 0)),
    countGrade: jest.fn(() => Promise.resolve(counts.grade ?? 0)),
    countArea: jest.fn(() => Promise.resolve(counts.area ?? 0)),
    groupUsage: jest.fn(() => Promise.resolve(new Map())),
    gradeUsage: jest.fn(() => Promise.resolve(new Map())),
    areaUsage: jest.fn(() => Promise.resolve(new Map())),
  } satisfies CatalogUsageRepository;
}

const levels = (existing: string[] = ['l-1', 'l-2']) =>
  ({
    find: jest.fn((id: string) => Promise.resolve(existing.includes(id) ? { id } : null)),
  }) as unknown as LevelsService;

async function codeOf(promise: Promise<unknown>): Promise<[number, string]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiCodedException);
  const { code, status } = error as ApiCodedException & { status: number };
  return [(error as ApiCodedException).getStatus() ?? status, code];
}

describe('GradesService', () => {
  function setup(options: { stored?: Grade | null; used?: number; deleted?: boolean } = {}) {
    const stored = options.stored === undefined ? grade() : options.stored;
    const repository = {
      findById: jest.fn(() => Promise.resolve(stored)),
      findPage: jest.fn(),
      findByName: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(() => Promise.resolve(grade())),
      update: jest.fn((_id: string, changes: object) =>
        Promise.resolve({ ...grade(), ...changes }),
      ),
      delete: jest.fn(() => Promise.resolve(options.deleted ?? true)),
      findIdsByCoordinator: jest.fn(() => Promise.resolve(['g-1'])),
      findExistingIds: jest.fn((ids: string[]) => Promise.resolve(ids.filter((id) => id !== 'x'))),
      setCoordinatorGrades: jest.fn(() => Promise.resolve()),
    } satisfies GradeRepository;
    const counts = usage({ grade: options.used });
    const users = {
      find: jest.fn((id: string) =>
        Promise.resolve(
          id === 'nobody'
            ? null
            : {
                id,
                fullName: 'Coordinadora',
                role: id === 'teacher' ? UserRole.Teacher : UserRole.Coordinator,
                status: id === 'gone' ? UserStatus.Inactive : UserStatus.Active,
              },
        ),
      ),
    } as unknown as UsersService;
    return { service: new GradesService(repository, counts, levels(), users), repository, counts };
  }

  it('borra un grado sin uso y rechaza con 409 catalogo_en_uso el que está en uso', async () => {
    const free = setup();
    await free.service.remove('g-1');
    expect(free.repository.delete).toHaveBeenCalledWith('g-1');

    const used = setup({ used: 3 });
    expect(await codeOf(used.service.remove('g-1'))).toEqual([409, ApiErrorCode.CatalogInUse]);
    await expect(used.service.remove('g-1')).rejects.toThrow(/3 registros/);
    expect(used.repository.delete).not.toHaveBeenCalled();
  });

  it('traduce a 409 una referencia que aparece entre la comprobación y el borrado', async () => {
    const { service } = setup({ deleted: false });

    expect(await codeOf(service.remove('g-1'))).toEqual([409, ApiErrorCode.CatalogInUse]);
  });

  it('responde 404 al borrar o editar un grado inexistente', async () => {
    const { service } = setup({ stored: null });

    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('x', { active: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no cambia el nivel de un grado en uso, pero sí desactiva, renombra o mueve uno sin uso', async () => {
    const used = setup({ used: 1 });
    await expect(used.service.update('g-1', { levelId: 'l-2' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await used.service.update('g-1', { active: false, name: 'Otro' });
    expect(used.repository.update).toHaveBeenCalledWith('g-1', { active: false, name: 'Otro' });

    const free = setup();
    await free.service.update('g-1', { levelId: 'l-2' });
    expect(free.repository.update).toHaveBeenCalled();
  });

  it('valida el nivel al crear y el nombre único', async () => {
    const { service, repository } = setup();
    await expect(
      service.create({ name: 'Uno', levelId: 'l-9', sortOrder: 1 }),
    ).rejects.toBeInstanceOf(RequestValidationException);

    repository.findByName.mockResolvedValueOnce(grade({ id: 'otro' }) as never);
    await expect(
      service.create({ name: 'Kinder', levelId: 'l-1', sortOrder: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('asigna grados a una coordinadora activa y devuelve sus grados', async () => {
    const { service, repository } = setup();

    const result = await service.setCoordinatorGrades('c-1', ['g-1']);

    expect(repository.setCoordinatorGrades).toHaveBeenCalledWith('c-1', ['g-1']);
    expect(result).toEqual({ id: 'c-1', fullName: 'Coordinadora', gradeIds: ['g-1'] });
  });

  it('rechaza un usuario inexistente (404), que no es coordinador activo (400) o un grado inexistente (400 con la posición)', async () => {
    const { service, repository } = setup();

    await expect(service.setCoordinatorGrades('nobody', [])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.setCoordinatorGrades('teacher', ['g-1'])).rejects.toBeInstanceOf(
      RequestValidationException,
    );
    await expect(service.setCoordinatorGrades('gone', ['g-1'])).rejects.toBeInstanceOf(
      RequestValidationException,
    );
    const error = await service.setCoordinatorGrades('c-1', ['g-1', 'x']).catch((e: unknown) => e);
    expect((error as RequestValidationException).fieldErrors).toEqual([
      { field: 'gradeIds.1', reason: 'no existe' },
    ]);
    expect(repository.setCoordinatorGrades).not.toHaveBeenCalled();
  });
});

describe('GroupsService', () => {
  function setup(options: { stored?: Group | null; used?: number; deleted?: boolean } = {}) {
    const stored = options.stored === undefined ? group() : options.stored;
    const repository = {
      findById: jest.fn(() => Promise.resolve(stored)),
      findPage: jest.fn(),
      findByName: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(() => Promise.resolve(group())),
      update: jest.fn((_id: string, changes: object) =>
        Promise.resolve({ ...group(), ...changes }),
      ),
      delete: jest.fn(() => Promise.resolve(options.deleted ?? true)),
    } satisfies GroupRepository;
    const grades = {
      find: jest.fn((id: string) => Promise.resolve(id === 'g-1' ? grade() : null)),
    } as unknown as GradesService;
    return {
      service: new GroupsService(repository, usage({ group: options.used }), grades),
      repository,
    };
  }

  it('crea en un grado existente con nombre único dentro del grado', async () => {
    const { service, repository } = setup();

    await service.create({ gradeId: 'g-1', name: 'Kinder 1' });
    expect(repository.findByName).toHaveBeenCalledWith('g-1', 'Kinder 1');

    const error = await service.create({ gradeId: 'g-9', name: 'X' }).catch((e: unknown) => e);
    expect((error as RequestValidationException).fieldErrors[0]?.field).toBe('gradeId');

    repository.findByName.mockResolvedValueOnce(group({ id: 'otro' }) as never);
    await expect(service.create({ gradeId: 'g-1', name: 'Kinder 1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('renombra dentro de su grado y permite conservar su propio nombre', async () => {
    const { service, repository } = setup();

    await service.update('gr-1', { name: 'Kinder 1', active: false });
    expect(repository.update).toHaveBeenCalled();

    repository.findByName.mockResolvedValueOnce(group({ id: 'otro' }) as never);
    await expect(service.update('gr-1', { name: 'Kinder 2' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('borra sin asignaciones y responde 409 catalogo_en_uso con ellas', async () => {
    const free = setup();
    await free.service.remove('gr-1');
    expect(free.repository.delete).toHaveBeenCalledWith('gr-1');

    const used = setup({ used: 2 });
    expect(await codeOf(used.service.remove('gr-1'))).toEqual([409, ApiErrorCode.CatalogInUse]);
    expect(used.repository.delete).not.toHaveBeenCalled();
    const raced = setup({ deleted: false });
    expect(await codeOf(raced.service.remove('gr-1'))).toEqual([409, ApiErrorCode.CatalogInUse]);
    await expect(setup({ stored: null }).service.remove('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AreasService', () => {
  function setup(options: { stored?: Area | null; used?: number; deleted?: boolean } = {}) {
    const stored = options.stored === undefined ? area() : options.stored;
    const repository = {
      findById: jest.fn(() => Promise.resolve(stored)),
      findPage: jest.fn(),
      findByName: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(() => Promise.resolve(area())),
      update: jest.fn((_id: string, changes: object) => Promise.resolve({ ...area(), ...changes })),
      delete: jest.fn(() => Promise.resolve(options.deleted ?? true)),
    } satisfies AreaRepository;
    return {
      service: new AreasService(repository, usage({ area: options.used }), levels()),
      repository,
    };
  }

  it('rechaza con 400 un nivel inexistente indicando su posición, al crear y al editar', async () => {
    const { service, repository } = setup();

    const created = await service
      .create({ name: 'Danza', type: 'asignatura', levelIds: ['l-1', 'l-9'] })
      .catch((e: unknown) => e);
    expect((created as RequestValidationException).fieldErrors).toEqual([
      { field: 'levelIds.1', reason: 'no existe' },
    ]);
    await expect(service.update('a-1', { levelIds: ['l-9'] })).rejects.toBeInstanceOf(
      RequestValidationException,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('guarda los niveles al crear y reemplaza el conjunto al editar', async () => {
    const { service, repository } = setup();

    await service.create({ name: 'Danza', type: 'asignatura', levelIds: ['l-1', 'l-2'] });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ levelIds: ['l-1', 'l-2'] }),
    );
    await service.update('a-1', { levelIds: ['l-2'], active: false });
    expect(repository.update).toHaveBeenCalledWith('a-1', { levelIds: ['l-2'], active: false });
  });

  it('rechaza el nombre repetido y responde 404 si el área no existe', async () => {
    const { service, repository } = setup();
    repository.findByName.mockResolvedValueOnce(area({ id: 'otra' }) as never);

    await expect(
      service.create({ name: 'Danza', type: 'asignatura', levelIds: ['l-1'] }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      setup({ stored: null }).service.update('x', { active: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('borra sin uso y responde 409 catalogo_en_uso en uso', async () => {
    const free = setup();
    await free.service.remove('a-1');
    expect(free.repository.delete).toHaveBeenCalledWith('a-1');

    const used = setup({ used: 1 });
    expect(await codeOf(used.service.remove('a-1'))).toEqual([409, ApiErrorCode.CatalogInUse]);
    expect(used.repository.delete).not.toHaveBeenCalled();
  });
});

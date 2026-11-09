import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { AreasService } from '../../estructura/catalogs/area/areas.service';
import type { LevelsService } from '../../estructura/catalogs/level/levels.service';
import { SharedActivitiesService } from './shared-activities.service';
import type {
  SharedActivityRecord,
  SharedActivityRepository,
  SharedActivityView,
} from './shared-activity.repository';

const NOW = new Date('2026-11-09T00:00:00Z');
const author: RequestUser = { id: 'author', role: UserRole.Teacher, sessionId: 's1' };
const stranger: RequestUser = { id: 'stranger', role: UserRole.Teacher, sessionId: 's2' };
const coordinator: RequestUser = { id: 'coord', role: UserRole.Coordinator, sessionId: 's3' };
const admin: RequestUser = { id: 'admin', role: UserRole.Administrator, sessionId: 's4' };

const view = (overrides: Partial<SharedActivityView> = {}): SharedActivityView => ({
  id: 'act-1',
  author: { id: 'author', fullName: 'Autora Uno' },
  level: null,
  area: null,
  title: 'Canción del agua',
  objective: null,
  durationMinutes: null,
  materials: null,
  steps: 'Cantar',
  link: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const record: SharedActivityRecord = {
  id: 'act-1',
  authorId: 'author',
  levelId: null,
  areaId: null,
  title: 'Canción del agua',
  objective: null,
  durationMinutes: null,
  materials: null,
  steps: 'Cantar',
  link: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function setup(
  options: { stored?: boolean; level?: boolean; area?: boolean; favorites?: string[] } = {},
) {
  const exists = options.stored !== false;
  const repository = {
    findById: jest.fn(() => Promise.resolve(exists ? view() : null)),
    findPage: jest.fn(() =>
      Promise.resolve({
        items: [view({ id: 'a' }), view({ id: 'b' })],
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      }),
    ),
    findRecordById: jest.fn(() => Promise.resolve(exists ? record : null)),
    create: jest.fn(() => Promise.resolve(view())),
    update: jest.fn(() => Promise.resolve(view({ title: 'Nuevo' }))),
    lock: jest.fn(() => Promise.resolve()),
    deleteWithFavorites: jest.fn(() => Promise.resolve()),
    findFavoriteIds: jest.fn((_userId: string, ids: readonly string[]) =>
      Promise.resolve(ids.filter((id) => (options.favorites ?? []).includes(id))),
    ),
    addFavorite: jest.fn(() => Promise.resolve()),
    removeFavorite: jest.fn(() => Promise.resolve()),
    countFavorites: jest.fn(() => Promise.resolve(3)),
  } satisfies SharedActivityRepository;
  const levels = { find: jest.fn(() => Promise.resolve(options.level === false ? null : {})) };
  const areas = { find: jest.fn(() => Promise.resolve(options.area === false ? null : {})) };
  const service = new SharedActivitiesService(
    repository,
    levels as unknown as LevelsService,
    areas as unknown as AreasService,
  );
  return { service, repository };
}

const listQuery = {
  page: 1,
  pageSize: 20,
  sort: { field: 'createdAt' as const, order: 'desc' as const },
};

async function fieldsOf(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(RequestValidationException);
  return (error as RequestValidationException).fieldErrors.map((item) => item.field);
}

describe('SharedActivitiesService: lectura', () => {
  it('marca isFavorite según quien consulta', async () => {
    const { service } = setup({ favorites: ['b'] });

    const page = await service.list(author, { ...listQuery, filters: {} });

    expect(page.items.map((item) => item.isFavorite)).toEqual([false, true]);
  });

  it('favorites=true se traduce al usuario de la sesión y no pasa a los filtros', async () => {
    const { service, repository } = setup();

    await service.list(stranger, { ...listQuery, filters: { q: 'rio', favorites: true } });

    expect(repository.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { q: 'rio', favoriteOf: 'stranger' } }),
    );
  });

  it('sin favorites no limita por favoritos', async () => {
    const { service, repository } = setup();

    await service.list(author, { ...listQuery, filters: {} });

    expect(repository.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { favoriteOf: undefined } }),
    );
  });

  it('el detalle responde 404 si no existe', async () => {
    await expect(setup({ stored: false }).service.get(author, 'act-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SharedActivitiesService.create', () => {
  const input = { title: 'Canción', steps: 'Cantar' };

  it('guarda con el usuario como autor y valores nulos por defecto', async () => {
    const { service, repository } = setup();

    const created = await service.create(author, input);

    expect(repository.create).toHaveBeenCalledWith({
      authorId: 'author',
      levelId: null,
      areaId: null,
      title: 'Canción',
      objective: null,
      durationMinutes: null,
      materials: null,
      steps: 'Cantar',
      link: null,
    });
    expect(created.isFavorite).toBe(false);
  });

  it('responde 400 por campo si el nivel o el área no existen', async () => {
    const levelId = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b01';
    const areaId = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b02';

    expect(
      await fieldsOf(setup({ level: false }).service.create(author, { ...input, levelId })),
    ).toEqual(['levelId']);
    expect(
      await fieldsOf(
        setup({ level: false, area: false }).service.create(author, { ...input, levelId, areaId }),
      ),
    ).toEqual(['levelId', 'areaId']);
  });
});

describe('SharedActivitiesService: editar y retirar (404, 403, 400)', () => {
  it('solo el autor edita y retira; coordinación y administración también reciben 403', async () => {
    for (const user of [stranger, coordinator, admin]) {
      const { service, repository } = setup();
      await expect(service.update(user, 'act-1', { title: 'X' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.remove(user, 'act-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.deleteWithFavorites).not.toHaveBeenCalled();
    }
  });

  it('responde 404 antes que 403 y que 400 si la actividad no existe', async () => {
    const { service } = setup({ stored: false });

    await expect(service.update(stranger, 'act-1', { levelId: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(author, 'act-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 403 antes que 400', async () => {
    const { service } = setup({ level: false });

    await expect(
      service.update(stranger, 'act-1', { levelId: '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b01' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el autor edita solo lo enviado, valida el nivel y devuelve isFavorite', async () => {
    const { service, repository } = setup({ favorites: ['act-1'] });

    const updated = await service.update(author, 'act-1', { title: 'Nuevo', link: null });

    expect(repository.update).toHaveBeenCalledWith('act-1', { title: 'Nuevo', link: null });
    expect(updated).toMatchObject({ title: 'Nuevo', isFavorite: true });
    expect(
      await fieldsOf(
        setup({ level: false }).service.update(author, 'act-1', {
          levelId: '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b01',
        }),
      ),
    ).toEqual(['levelId']);
  });

  it('el retiro bloquea la fila y borra la actividad con sus favoritos', async () => {
    const { service, repository } = setup();

    await service.remove(author, 'act-1');

    expect(repository.lock).toHaveBeenCalledWith('act-1');
    expect(repository.deleteWithFavorites).toHaveBeenCalledWith('act-1');
  });

  it('responde 404 si otra petición la retiró entre la comprobación y el bloqueo', async () => {
    const { service, repository } = setup();
    repository.findRecordById.mockResolvedValueOnce(record).mockResolvedValueOnce(null);

    await expect(service.remove(author, 'act-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.deleteWithFavorites).not.toHaveBeenCalled();
  });
});

describe('SharedActivitiesService: favoritos', () => {
  it('marcar y desmarcar responden 404 si no existe y delegan si existe', async () => {
    const missing = setup({ stored: false });
    await expect(missing.service.favorite(author, 'act-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(missing.service.unfavorite(author, 'act-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const { service, repository } = setup();
    await service.favorite(stranger, 'act-1');
    await service.unfavorite(stranger, 'act-1');
    expect(repository.addFavorite).toHaveBeenCalledWith('stranger', 'act-1');
    expect(repository.removeFavorite).toHaveBeenCalledWith('stranger', 'act-1');
  });

  it('el conteo para la bitácora es null si la actividad ya no existe', async () => {
    await expect(setup().service.favoriteCountForAudit('act-1')).resolves.toBe(3);
    await expect(
      setup({ stored: false }).service.favoriteCountForAudit('act-1'),
    ).resolves.toBeNull();
  });
});

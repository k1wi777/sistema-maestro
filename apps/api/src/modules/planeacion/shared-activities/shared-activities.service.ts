import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ApiFieldError,
  type CreateSharedActivityInput,
  type ListQuery,
  type Page,
  type SharedActivity,
  type SharedActivityListFilters,
  type SharedActivitySortField,
  type UpdateSharedActivityInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { LevelsService } from '../../estructura/catalogs/level/levels.service';
import {
  SHARED_ACTIVITY_REPOSITORY,
  type SharedActivityChanges,
  type SharedActivityRecord,
  type SharedActivityRepository,
  type SharedActivityView,
} from './shared-activity.repository';

const NOT_FOUND = 'Actividad no encontrada';

/**
 * Repositorio de actividades de la comunidad: todo docente (y superior) ve todas; solo el
 * autor edita y retira las suyas, y cualquiera marca favoritas. Las escrituras responden
 * 404 → 403 → 400, en ese orden.
 */
@Injectable()
export class SharedActivitiesService {
  constructor(
    @Inject(SHARED_ACTIVITY_REPOSITORY) private readonly repository: SharedActivityRepository,
    private readonly levels: LevelsService,
    private readonly areas: AreasService,
  ) {}

  // ---------- Lectura ----------

  /** `favorites=true` se traduce al usuario de la sesión: el id nunca viene de la query. */
  async list(
    user: RequestUser,
    query: ListQuery<SharedActivityListFilters, SharedActivitySortField>,
  ): Promise<Page<SharedActivity>> {
    const { favorites, ...filters } = query.filters;
    const page = await this.repository.findPage({
      ...query,
      filters: { ...filters, favoriteOf: favorites ? user.id : undefined },
    });
    const favoriteIds = new Set(
      await this.repository.findFavoriteIds(
        user.id,
        page.items.map((item) => item.id),
      ),
    );
    return {
      ...page,
      items: page.items.map((item) => ({ ...item, isFavorite: favoriteIds.has(item.id) })),
    };
  }

  async get(user: RequestUser, id: string): Promise<SharedActivity> {
    const view = await this.repository.findById(id);
    if (!view) {
      throw new NotFoundException(NOT_FOUND);
    }
    return this.withFavorite(user, view);
  }

  /** Fila sin relaciones para la bitácora; sin comprobar autoría (no sale por la API). */
  findRaw(id: string): Promise<SharedActivityRecord | null> {
    return this.repository.findRecordById(id);
  }

  /** Cuántos docentes la guardaron, para la bitácora de los favoritos (`null` si no existe). */
  async favoriteCountForAudit(id: string): Promise<number | null> {
    if (!(await this.repository.findRecordById(id))) {
      return null;
    }
    return this.repository.countFavorites(id);
  }

  // ---------- Escritura del autor ----------

  async create(user: RequestUser, input: CreateSharedActivityInput): Promise<SharedActivity> {
    await this.requireCatalogs(input);
    const created = await this.repository.create({
      authorId: user.id,
      levelId: input.levelId ?? null,
      areaId: input.areaId ?? null,
      title: input.title,
      objective: input.objective ?? null,
      durationMinutes: input.durationMinutes ?? null,
      materials: input.materials ?? null,
      steps: input.steps,
      link: input.link ?? null,
    });
    return { ...created, isFavorite: false };
  }

  async update(
    user: RequestUser,
    id: string,
    input: UpdateSharedActivityInput,
  ): Promise<SharedActivity> {
    await this.requireOwn(user, id);
    await this.requireCatalogs(input);
    const changes: SharedActivityChanges = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    const updated = await this.repository.update(id, changes);
    return this.withFavorite(user, updated);
  }

  /**
   * Retiro físico: la actividad no es un registro pedagógico del flujo de revisión y su autor
   * debe poder quitarla del todo. La bitácora conserva su contenido (`datos_antes`). Con la
   * fila bloqueada, un «marcar favorita» simultáneo espera y después falla por FK (409).
   */
  async remove(user: RequestUser, id: string): Promise<void> {
    await this.requireOwn(user, id);
    await this.repository.lock(id);
    if (!(await this.repository.findRecordById(id))) {
      throw new NotFoundException(NOT_FOUND);
    }
    await this.repository.deleteWithFavorites(id);
  }

  // ---------- Favoritos ----------

  async favorite(user: RequestUser, id: string): Promise<void> {
    await this.requireExisting(id);
    await this.repository.addFavorite(user.id, id);
  }

  async unfavorite(user: RequestUser, id: string): Promise<void> {
    await this.requireExisting(id);
    await this.repository.removeFavorite(user.id, id);
  }

  // ---------- Comprobaciones ----------

  private async requireExisting(id: string): Promise<SharedActivityRecord> {
    const record = await this.repository.findRecordById(id);
    if (!record) {
      throw new NotFoundException(NOT_FOUND);
    }
    return record;
  }

  /** 404 y luego 403: solo el autor, también frente a coordinación y administración. */
  private async requireOwn(user: RequestUser, id: string): Promise<SharedActivityRecord> {
    const record = await this.requireExisting(id);
    if (record.authorId !== user.id) {
      throw new ForbiddenException(
        'Solo quien compartió la actividad puede modificarla o retirarla',
      );
    }
    return record;
  }

  /** Nivel y área deben existir: 400 por campo en lugar del 409 genérico de una FK. */
  private async requireCatalogs(input: { levelId?: string | null; areaId?: string | null }) {
    const errors: ApiFieldError[] = [];
    if (input.levelId && !(await this.levels.find(input.levelId))) {
      errors.push({ field: 'levelId', reason: 'no existe' });
    }
    if (input.areaId && !(await this.areas.find(input.areaId))) {
      errors.push({ field: 'areaId', reason: 'no existe' });
    }
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }
  }

  private async withFavorite(user: RequestUser, view: SharedActivityView): Promise<SharedActivity> {
    const [favoriteId] = await this.repository.findFavoriteIds(user.id, [view.id]);
    return { ...view, isFavorite: favoriteId === view.id };
  }
}

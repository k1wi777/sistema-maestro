import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ApiFieldError,
  type CreateSharedActivityInput,
  type ListQuery,
  type Page,
  type SharedActivity,
  type SharedActivityCorners,
  type SharedActivityListFilters,
  type SharedActivitySortField,
  type UpdateSharedActivityInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { GradesService } from '../../estructura/catalogs/grade/grades.service';
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
    private readonly grades: GradesService,
  ) {}

  // ---------- Lectura ----------

  /**
   * `favorites=true` se traduce al usuario de la sesión: el id nunca viene de la query. El grado
   * del filtro se traduce a su nivel para incluir las actividades de todo el nivel; si el grado
   * no existe la página queda vacía.
   */
  async list(
    user: RequestUser,
    query: ListQuery<SharedActivityListFilters, SharedActivitySortField>,
  ): Promise<Page<SharedActivity>> {
    const { favorites, ...filters } = query.filters;
    let gradeLevelId: string | undefined;
    if (filters.gradeId) {
      const grade = await this.grades.find(filters.gradeId);
      if (!grade) {
        return {
          items: [],
          page: query.page,
          pageSize: query.pageSize,
          totalItems: 0,
          totalPages: 0,
        };
      }
      gradeLevelId = grade.levelId;
    }
    const page = await this.repository.findPage({
      ...query,
      filters: { ...filters, gradeLevelId, favoriteOf: favorites ? user.id : undefined },
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

  /** Rincones distintos en uso, opcionalmente solo los de un nivel. */
  async corners(levelId?: string): Promise<SharedActivityCorners> {
    return { items: await this.repository.findCorners(levelId) };
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
    const { levelId } = await this.resolveClassification(null, input);
    const created = await this.repository.create({
      authorId: user.id,
      levelId: levelId ?? input.levelId ?? null,
      areaId: input.areaId ?? null,
      gradeId: input.gradeId ?? null,
      learningCorner: input.learningCorner ?? null,
      activityType: input.activityType,
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
    const stored = await this.requireOwn(user, id);
    const { levelId } = await this.resolveClassification(stored, input);
    const changes: SharedActivityChanges = {
      ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      ...(levelId === undefined ? {} : { levelId }),
    };
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

  /**
   * Nivel, área y grado deben existir y el grado debe ser del nivel con que queda la actividad
   * (400 por campo en lugar del 409 genérico de una FK). Se evalúa el estado final: lo enviado
   * y, si falta, lo guardado. Con grado, el nivel se deriva del grado cuando la petición no trae
   * un nivel; se devuelve ese nivel derivado (`undefined` si no hay que tocarlo).
   */
  private async resolveClassification(
    stored: Pick<SharedActivityRecord, 'gradeId'> | null,
    input: { levelId?: string | null; areaId?: string | null; gradeId?: string | null },
  ): Promise<{ levelId?: string }> {
    const errors: ApiFieldError[] = [];
    const levelExists = !input.levelId || Boolean(await this.levels.find(input.levelId));
    if (!levelExists) {
      errors.push({ field: 'levelId', reason: 'no existe' });
    }
    if (input.areaId && !(await this.areas.find(input.areaId))) {
      errors.push({ field: 'areaId', reason: 'no existe' });
    }
    const gradeId = input.gradeId === undefined ? (stored?.gradeId ?? null) : input.gradeId;
    const touchesGrade = input.gradeId !== undefined || input.levelId !== undefined;
    let derivedLevelId: string | undefined;
    if (gradeId && touchesGrade) {
      const grade = await this.grades.find(gradeId);
      if (!grade) {
        errors.push({ field: 'gradeId', reason: 'no existe' });
      } else if (!input.levelId) {
        derivedLevelId = grade.levelId;
      } else if (levelExists && grade.levelId !== input.levelId) {
        errors.push({ field: 'gradeId', reason: 'no pertenece al nivel' });
      }
    }
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }
    return { levelId: derivedLevelId };
  }

  private async withFavorite(user: RequestUser, view: SharedActivityView): Promise<SharedActivity> {
    const [favoriteId] = await this.repository.findFavoriteIds(user.id, [view.id]);
    return { ...view, isFavorite: favoriteId === view.id };
  }
}

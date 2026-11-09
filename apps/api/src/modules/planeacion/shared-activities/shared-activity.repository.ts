import type { SharedActivity, SharedActivityFilters, SharedActivitySortField } from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

/** Actividad con autor, nivel y área anidados; `isFavorite` depende de quien consulta y lo añade el servicio. */
export type SharedActivityView = Omit<SharedActivity, 'isFavorite'>;

export type SharedActivityContent = {
  levelId: string | null;
  areaId: string | null;
  title: string;
  objective: string | null;
  durationMinutes: number | null;
  materials: string | null;
  steps: string;
  link: string | null;
};

export type NewSharedActivity = SharedActivityContent & { authorId: string };

/** Solo lo que la petición trae; `null` vacía el campo y `undefined` no lo toca. */
export type SharedActivityChanges = Partial<SharedActivityContent>;

/** Fila sin relaciones: lo que se registra en la bitácora. */
export type SharedActivityRecord = NewSharedActivity & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface SharedActivityRepository extends ReadRepository<
  SharedActivityView,
  SharedActivityFilters,
  SharedActivitySortField
> {
  findRecordById(id: string): Promise<SharedActivityRecord | null>;
  create(input: NewSharedActivity): Promise<SharedActivityView>;
  update(id: string, changes: SharedActivityChanges): Promise<SharedActivityView>;
  /** Bloquea la fila hasta el fin de la transacción para serializar el retiro con los favoritos. */
  lock(id: string): Promise<void>;
  /** Borra los favoritos de la actividad y luego la actividad (las FK no son en cascada). */
  deleteWithFavorites(id: string): Promise<void>;
  /** De los `ids`, los que son favoritos del usuario. */
  findFavoriteIds(userId: string, ids: readonly string[]): Promise<string[]>;
  /** Idempotente: repetir o competir con otra petición no falla. */
  addFavorite(userId: string, activityId: string): Promise<void>;
  /** Idempotente: no falla si no estaba marcada. */
  removeFavorite(userId: string, activityId: string): Promise<void>;
  countFavorites(activityId: string): Promise<number>;
}

export const SHARED_ACTIVITY_REPOSITORY = Symbol('SHARED_ACTIVITY_REPOSITORY');

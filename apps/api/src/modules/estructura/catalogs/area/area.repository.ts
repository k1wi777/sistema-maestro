import type {
  Area,
  AreaFilters,
  AreaSortField,
  CreateAreaInput,
  UpdateAreaInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../../shared/repository/repository';

export interface AreaRepository extends ReadRepository<Area, AreaFilters, AreaSortField> {
  findByName(name: string): Promise<Area | null>;
  create(input: CreateAreaInput): Promise<Area>;
  update(id: string, changes: UpdateAreaInput): Promise<Area>;
  /** Borra el área y su relación con los niveles. `false` si una referencia nueva lo impidió. */
  delete(id: string): Promise<boolean>;
}

export const AREA_REPOSITORY = Symbol('AREA_REPOSITORY');

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
}

export const AREA_REPOSITORY = Symbol('AREA_REPOSITORY');

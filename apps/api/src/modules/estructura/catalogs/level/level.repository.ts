import type {
  CreateLevelInput,
  Level,
  LevelFilters,
  LevelSortField,
  UpdateLevelInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../../shared/repository/repository';

export interface LevelRepository extends ReadRepository<Level, LevelFilters, LevelSortField> {
  findByName(name: string): Promise<Level | null>;
  create(input: CreateLevelInput): Promise<Level>;
  update(id: string, changes: UpdateLevelInput): Promise<Level>;
}

export const LEVEL_REPOSITORY = Symbol('LEVEL_REPOSITORY');

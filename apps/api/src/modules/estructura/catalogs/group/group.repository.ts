import type {
  CreateGroupInput,
  Group,
  GroupFilters,
  GroupSortField,
  UpdateGroupInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../../shared/repository/repository';

export interface GroupRepository extends ReadRepository<Group, GroupFilters, GroupSortField> {
  findByName(gradeId: string, name: string): Promise<Group | null>;
  create(input: CreateGroupInput): Promise<Group>;
  update(id: string, changes: UpdateGroupInput): Promise<Group>;
  /** `false` si una referencia nueva impidió el borrado. */
  delete(id: string): Promise<boolean>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');

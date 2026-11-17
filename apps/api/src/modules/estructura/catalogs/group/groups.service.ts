import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGroupInput,
  Group,
  GroupFilters,
  GroupSortField,
  ListQuery,
  Page,
  UpdateGroupInput,
} from '@gns/shared';
import { RequestValidationException } from '../../../../core/http/request-validation.exception';
import { CatalogInUseException } from '../catalog-in-use.exception';
import { CATALOG_USAGE_REPOSITORY, type CatalogUsageRepository } from '../catalog-usage.repository';
import { GradesService } from '../grade/grades.service';
import { GROUP_REPOSITORY, type GroupRepository } from './group.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un grupo con ese nombre en el grado';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly repository: GroupRepository,
    @Inject(CATALOG_USAGE_REPOSITORY) private readonly usage: CatalogUsageRepository,
    private readonly grades: GradesService,
  ) {}

  list(query: ListQuery<GroupFilters, GroupSortField>): Promise<Page<Group>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<Group | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateGroupInput): Promise<Group> {
    if (!(await this.grades.find(input.gradeId))) {
      throw new RequestValidationException([{ field: 'gradeId', reason: 'no existe' }]);
    }
    if (await this.repository.findByName(input.gradeId, input.name)) {
      throw new ConflictException(NAME_TAKEN_MESSAGE);
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateGroupInput): Promise<Group> {
    const current = await this.get(id);
    if (input.name !== undefined && input.name !== current.name) {
      const owner = await this.repository.findByName(current.gradeId, input.name);
      if (owner && owner.id !== id) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }

  /** Borra el grupo solo si no tiene asignaciones; con ellas, 409 con el número de usos. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.usage.countGroup(id);
    if (used > 0 || !(await this.repository.delete(id))) {
      throw new CatalogInUseException('El grupo', Math.max(used, 1));
    }
  }

  private async get(id: string): Promise<Group> {
    const group = await this.find(id);
    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }
    return group;
  }
}

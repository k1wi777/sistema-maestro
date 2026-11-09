import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Area,
  AreaFilters,
  AreaSortField,
  CreateAreaInput,
  ListQuery,
  Page,
  UpdateAreaInput,
} from '@gns/shared';
import { AREA_REPOSITORY, type AreaRepository } from './area.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un área con ese nombre';

@Injectable()
export class AreasService {
  constructor(@Inject(AREA_REPOSITORY) private readonly repository: AreaRepository) {}

  list(query: ListQuery<AreaFilters, AreaSortField>): Promise<Page<Area>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<Area | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateAreaInput): Promise<Area> {
    if (await this.repository.findByName(input.name)) {
      throw new ConflictException(NAME_TAKEN_MESSAGE);
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateAreaInput): Promise<Area> {
    const current = await this.find(id);
    if (!current) {
      throw new NotFoundException('Área no encontrada');
    }
    if (input.name !== undefined && input.name !== current.name) {
      const owner = await this.repository.findByName(input.name);
      if (owner && owner.id !== id) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }
}

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLevelInput,
  Level,
  LevelFilters,
  LevelSortField,
  ListQuery,
  Page,
  UpdateLevelInput,
} from '@gns/shared';
import { LEVEL_REPOSITORY, type LevelRepository } from './level.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un nivel con ese nombre';

@Injectable()
export class LevelsService {
  constructor(@Inject(LEVEL_REPOSITORY) private readonly repository: LevelRepository) {}

  list(query: ListQuery<LevelFilters, LevelSortField>): Promise<Page<Level>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<Level | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateLevelInput): Promise<Level> {
    if (await this.repository.findByName(input.name)) {
      throw new ConflictException(NAME_TAKEN_MESSAGE);
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateLevelInput): Promise<Level> {
    const current = await this.find(id);
    if (!current) {
      throw new NotFoundException('Nivel no encontrado');
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

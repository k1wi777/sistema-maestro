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
import { RequestValidationException } from '../../../../core/http/request-validation.exception';
import { CatalogInUseException } from '../catalog-in-use.exception';
import { CATALOG_USAGE_REPOSITORY, type CatalogUsageRepository } from '../catalog-usage.repository';
import { LevelsService } from '../level/levels.service';
import { AREA_REPOSITORY, type AreaRepository } from './area.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un área con ese nombre';

@Injectable()
export class AreasService {
  constructor(
    @Inject(AREA_REPOSITORY) private readonly repository: AreaRepository,
    @Inject(CATALOG_USAGE_REPOSITORY) private readonly usage: CatalogUsageRepository,
    private readonly levels: LevelsService,
  ) {}

  list(query: ListQuery<AreaFilters, AreaSortField>): Promise<Page<Area>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<Area | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateAreaInput): Promise<Area> {
    await this.requireLevels(input.levelIds);
    if (await this.repository.findByName(input.name)) {
      throw new ConflictException(NAME_TAKEN_MESSAGE);
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateAreaInput): Promise<Area> {
    const current = await this.get(id);
    if (input.levelIds !== undefined) {
      await this.requireLevels(input.levelIds);
    }
    if (input.name !== undefined && input.name !== current.name) {
      const owner = await this.repository.findByName(input.name);
      if (owner && owner.id !== id) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }

  /** Borra el área y su relación con los niveles solo si nada la usa; en uso, 409 con el número. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.usage.countArea(id);
    if (used > 0 || !(await this.repository.delete(id))) {
      throw new CatalogInUseException('El área', Math.max(used, 1));
    }
  }

  private async get(id: string): Promise<Area> {
    const area = await this.find(id);
    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }
    return area;
  }

  /** Cada nivel debe existir: el error nombra la posición del que falta. */
  private async requireLevels(levelIds: string[]): Promise<void> {
    const found = await Promise.all(levelIds.map((levelId) => this.levels.find(levelId)));
    const errors = levelIds.flatMap((_, index) =>
      found[index] ? [] : [{ field: `levelIds.${index}`, reason: 'no existe' }],
    );
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }
  }
}

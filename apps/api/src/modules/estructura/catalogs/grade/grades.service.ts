import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGradeInput,
  Grade,
  GradeFilters,
  GradeSortField,
  ListQuery,
  Page,
  UpdateGradeInput,
} from '@gns/shared';
import { RequestValidationException } from '../../../../core/http/request-validation.exception';
import { LevelsService } from '../level/levels.service';
import { GRADE_REPOSITORY, type GradeRepository } from './grade.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un grado con ese nombre';

@Injectable()
export class GradesService {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly repository: GradeRepository,
    private readonly levels: LevelsService,
  ) {}

  list(query: ListQuery<GradeFilters, GradeSortField>): Promise<Page<Grade>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<Grade | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateGradeInput): Promise<Grade> {
    await this.requireLevel(input.levelId);
    if (await this.repository.findByName(input.name)) {
      throw new ConflictException(NAME_TAKEN_MESSAGE);
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateGradeInput): Promise<Grade> {
    const current = await this.find(id);
    if (!current) {
      throw new NotFoundException('Grado no encontrado');
    }
    if (input.levelId !== undefined && input.levelId !== current.levelId) {
      await this.requireLevel(input.levelId);
    }
    if (input.name !== undefined && input.name !== current.name) {
      const owner = await this.repository.findByName(input.name);
      if (owner && owner.id !== id) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }

  // El recurso de la ruta existe; lo inválido es el cuerpo: 400 y no 404.
  private async requireLevel(levelId: string): Promise<void> {
    if (!(await this.levels.find(levelId))) {
      throw new RequestValidationException([{ field: 'levelId', reason: 'no existe' }]);
    }
  }
}

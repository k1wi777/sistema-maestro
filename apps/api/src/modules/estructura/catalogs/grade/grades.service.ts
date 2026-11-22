import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  AuditLogType,
  UserRole,
  UserStatus,
  type CoordinatorGrades,
  type CreateGradeInput,
  type Grade,
  type GradeFilters,
  type GradeSortField,
  type ListQuery,
  type Page,
  type UpdateGradeInput,
} from '@gns/shared';
import { RequestValidationException } from '../../../../core/http/request-validation.exception';
import { AuditLogService } from '../../../auditoria/audit-log.service';
import {
  UserRoleChangeEffects,
  type UserRoleChange,
  type UserRoleChangeEffect,
} from '../../../identidad/users/user-role-change-effects';
import { UsersService } from '../../../identidad/users/users.service';
import { CatalogInUseException } from '../catalog-in-use.exception';
import { CATALOG_USAGE_REPOSITORY, type CatalogUsageRepository } from '../catalog-usage.repository';
import { LevelsService } from '../level/levels.service';
import { GRADE_REPOSITORY, type GradeRepository } from './grade.repository';

const NAME_TAKEN_MESSAGE = 'Ya existe un grado con ese nombre';
const LEVEL_IN_USE_MESSAGE =
  'El grado tiene registros o asignaciones: no se puede cambiar su nivel';

@Injectable()
export class GradesService implements UserRoleChangeEffect, OnModuleInit {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly repository: GradeRepository,
    @Inject(CATALOG_USAGE_REPOSITORY) private readonly usage: CatalogUsageRepository,
    private readonly levels: LevelsService,
    private readonly users: UsersService,
    private readonly audit: AuditLogService,
    private readonly roleEffects: UserRoleChangeEffects,
  ) {}

  onModuleInit(): void {
    this.roleEffects.register(this);
  }

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
    const current = await this.get(id);
    if (input.levelId !== undefined && input.levelId !== current.levelId) {
      await this.requireLevel(input.levelId);
      if ((await this.usage.countGrade(id)) > 0) {
        throw new ConflictException(LEVEL_IN_USE_MESSAGE);
      }
    }
    if (input.name !== undefined && input.name !== current.name) {
      const owner = await this.repository.findByName(input.name);
      if (owner && owner.id !== id) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }
    }
    return this.repository.update(id, input);
  }

  /** Borra el grado y sus grupos solo si nada lo usa; en uso, 409 con el número de usos. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.usage.countGrade(id);
    if (used > 0 || !(await this.repository.delete(id))) {
      throw new CatalogInUseException('El grado', Math.max(used, 1));
    }
  }

  /**
   * Efecto de un cambio de rol (#115): quien deja de ser coordinadora deja sus grados sin
   * coordinadora (nadie los revisa hasta que administración asigne a otra persona) y queda
   * constancia en la bitácora con los grados por nombre.
   */
  async onRoleChange({ userId, from, actor }: UserRoleChange): Promise<void> {
    if (from !== UserRole.Coordinator) {
      return;
    }
    const gradeIds = await this.repository.findIdsByCoordinator(userId);
    if (gradeIds.length === 0) {
      return;
    }
    const names = (await Promise.all(gradeIds.map((id) => this.find(id)))).map(
      (grade) => grade?.name ?? 'grado',
    );
    await this.repository.setCoordinatorGrades(userId, []);
    await this.audit.record({
      userId: actor.id,
      role: actor.role,
      type: AuditLogType.Users,
      action: 'Dejó grados sin coordinadora por cambio de rol',
      entity: 'usuario',
      entityId: userId,
      detail: names.join(', '),
    });
  }

  /** Ids de los grados que coordina la usuaria, por orden del grado. */
  coordinatorGradeIds(coordinatorId: string): Promise<string[]> {
    return this.repository.findIdsByCoordinator(coordinatorId);
  }

  /**
   * Reemplaza los grados de una coordinadora: los pedidos pasan a ella (quitándolos a quien
   * los tuviera) y los que tenía y ya no están quedan sin coordinadora.
   */
  async setCoordinatorGrades(
    coordinatorId: string,
    gradeIds: string[],
  ): Promise<CoordinatorGrades> {
    const user = await this.users.find(coordinatorId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.role !== UserRole.Coordinator || user.status !== UserStatus.Active) {
      throw new RequestValidationException([
        { field: 'id', reason: 'el usuario no es una coordinadora activa' },
      ]);
    }
    const existing = new Set(await this.repository.findExistingIds(gradeIds));
    const missing = gradeIds.flatMap((gradeId, index) =>
      existing.has(gradeId) ? [] : [{ field: `gradeIds.${index}`, reason: 'no existe' }],
    );
    if (missing.length > 0) {
      throw new RequestValidationException(missing);
    }
    await this.repository.setCoordinatorGrades(coordinatorId, gradeIds);
    return {
      id: user.id,
      fullName: user.fullName,
      gradeIds: await this.repository.findIdsByCoordinator(coordinatorId),
    };
  }

  private async get(id: string): Promise<Grade> {
    const grade = await this.find(id);
    if (!grade) {
      throw new NotFoundException('Grado no encontrado');
    }
    return grade;
  }

  // El recurso de la ruta existe; lo inválido es el cuerpo: 400 y no 404.
  private async requireLevel(levelId: string): Promise<void> {
    if (!(await this.levels.find(levelId))) {
      throw new RequestValidationException([{ field: 'levelId', reason: 'no existe' }]);
    }
  }
}

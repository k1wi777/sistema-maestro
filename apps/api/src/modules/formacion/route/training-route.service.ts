import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TrainingActivityStatus,
  TrainingModuleStatus,
  type MyAssignments,
  type TeacherModule,
  type TeacherRoute,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import {
  TRAINING_PLAN_REPOSITORY,
  type ActivityScopeRow,
  type TeacherModuleRow,
  type TrainingPlanRepository,
} from '../plans/training-plan.repository';
import {
  TRAINING_PROGRESS_REPOSITORY,
  type TrainingProgressRepository,
} from '../progress/training-progress.repository';
import { projectModule, projectRoute } from './teacher-projection';

interface Visibility {
  schoolYear: string;
  areaIds: ReadonlySet<string>;
}

const NOT_FOUND = 'Módulo no encontrado en tu ruta';

/**
 * Ruta del docente y única autoridad sobre qué ve: `requireVisibleModule` y
 * `requireVisibleActivity` aplican la misma regla que la ruta, y todo lo que no cumple es 404
 * sin revelar su contenido (R17).
 */
@Injectable()
export class TrainingRouteService {
  constructor(
    @Inject(TRAINING_PLAN_REPOSITORY) private readonly plans: TrainingPlanRepository,
    @Inject(TRAINING_PROGRESS_REPOSITORY) private readonly progress: TrainingProgressRepository,
    private readonly assignments: TeacherAssignmentsService,
  ) {}

  /** Año vigente y áreas con asignación activa del docente; sin año vigente, 409. */
  private async visibilityOf(teacherId: string): Promise<Visibility> {
    const mine: MyAssignments = await this.assignments.listMine(teacherId);
    return {
      schoolYear: mine.schoolYear,
      areaIds: new Set(mine.grades.flatMap((grade) => grade.areas.map((area) => area.id))),
    };
  }

  private planIsVisible(
    scope: { planAreaId: string | null; planSchoolYear: string | null },
    visibility: Visibility,
  ): boolean {
    return (
      (scope.planAreaId === null || visibility.areaIds.has(scope.planAreaId)) &&
      (scope.planSchoolYear === null || scope.planSchoolYear === visibility.schoolYear)
    );
  }

  route(user: RequestUser): Promise<TeacherRoute> {
    return this.routeOf(user.id);
  }

  /** Ruta de cualquier docente: la misma regla para él y para el seguimiento de coordinación. */
  async routeOf(teacherId: string): Promise<TeacherRoute> {
    const visibility = await this.visibilityOf(teacherId);
    const plans = await this.plans.findRoutePlans([...visibility.areaIds], visibility.schoolYear);
    const modules = plans.flatMap((plan) => plan.sections.flatMap((section) => section.modules));
    const [moduleProgress, activityProgress] = await Promise.all([
      this.progress.listModuleProgress(
        teacherId,
        modules.map((module) => module.id),
      ),
      this.progress.listActivityProgress(
        teacherId,
        modules.flatMap((module) => module.activities.map((activity) => activity.id)),
      ),
    ]);
    return projectRoute(
      visibility.schoolYear,
      plans,
      new Map(moduleProgress.map((item) => [item.moduleId, item])),
      new Map(activityProgress.map((item) => [item.activityId, item])),
    );
  }

  /** Ids de los módulos activos de la ruta vigente del docente (para el certificado de ruta). */
  async routeModuleIds(teacherId: string): Promise<string[]> {
    const visibility = await this.visibilityOf(teacherId);
    const plans = await this.plans.findRoutePlans([...visibility.areaIds], visibility.schoolYear);
    return plans.flatMap((plan) =>
      plan.sections.flatMap((section) => section.modules.map((module) => module.id)),
    );
  }

  async requireVisibleModule(user: RequestUser, moduleId: string): Promise<TeacherModuleRow> {
    const visibility = await this.visibilityOf(user.id);
    const row = await this.plans.findTeacherModule(moduleId);
    if (
      !row ||
      row.status !== TrainingModuleStatus.Active ||
      !this.planIsVisible(row, visibility)
    ) {
      throw new NotFoundException(NOT_FOUND);
    }
    return row;
  }

  /** Actividad activa de un módulo activo de la ruta; otra cosa es 404. */
  async requireVisibleActivity(user: RequestUser, activityId: string): Promise<ActivityScopeRow> {
    const visibility = await this.visibilityOf(user.id);
    const row = await this.plans.findActivityScope(activityId);
    if (
      !row ||
      row.activity.status !== TrainingActivityStatus.Active ||
      row.moduleStatus !== TrainingModuleStatus.Active ||
      !this.planIsVisible(row, visibility)
    ) {
      throw new NotFoundException('Actividad no encontrada en tu ruta');
    }
    return row;
  }

  async getModule(user: RequestUser, moduleId: string): Promise<TeacherModule> {
    const row = await this.requireVisibleModule(user, moduleId);
    const [moduleProgress, activityProgress] = await Promise.all([
      this.progress.listModuleProgress(user.id, [moduleId]),
      this.progress.listActivityProgress(
        user.id,
        row.activities.map((activity) => activity.id),
      ),
    ]);
    return projectModule(
      row,
      moduleProgress[0],
      new Map(activityProgress.map((item) => [item.activityId, item])),
    );
  }
}

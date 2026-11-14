import { Inject, Injectable } from '@nestjs/common';
import {
  AuditLogType,
  TeacherModuleState,
  TrackingModuleState,
  TrainingModuleStatus,
  type PlanTracking,
  type TeacherTracking,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { toCsv } from '../../../shared/csv/csv';
import { AuditLogService } from '../../auditoria/audit-log.service';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { UsersService } from '../../identidad/users/users.service';
import { CertificatesService } from '../certificates/certificates.service';
import { TrainingPlansService } from '../plans/training-plans.service';
import { TrainingRouteService } from '../route/training-route.service';
import {
  EXPORT_HEADER,
  exportFileName,
  exportRows,
  summarizePlan,
  type TrackedModule,
  type TrackedProgress,
  type TrackedTeacher,
} from './tracking-summary';
import {
  TRAINING_TRACKING_REPOSITORY,
  type TrackedCertificate,
  type TrainingTrackingRepository,
} from './training-tracking.repository';

const STATE_OF_TEACHER_MODULE: Record<TeacherModuleState, TrackingModuleState> = {
  [TeacherModuleState.Pending]: TrackingModuleState.NotStarted,
  [TeacherModuleState.InProgress]: TrackingModuleState.InProgress,
  [TeacherModuleState.Done]: TrackingModuleState.Done,
};

/** Datos del plan listos para la matriz y la exportación. */
export interface PlanTrackingData {
  tracking: PlanTracking;
  /** Pares docente-módulo con certificado, para la columna «Certificado» del CSV. */
  certificates: ReadonlySet<string>;
}

/**
 * Seguimiento de la formación para coordinación (solo lectura). El alcance de un plan sale de la
 * estructura académica y la ruta de un docente de la misma regla de visibilidad que usa él.
 */
@Injectable()
export class TrainingTrackingService {
  constructor(
    @Inject(TRAINING_TRACKING_REPOSITORY) private readonly repository: TrainingTrackingRepository,
    private readonly plans: TrainingPlansService,
    private readonly route: TrainingRouteService,
    private readonly assignments: TeacherAssignmentsService,
    private readonly schoolYears: SchoolYearsService,
    private readonly areas: AreasService,
    private readonly users: UsersService,
    private readonly certificates: CertificatesService,
    private readonly audit: AuditLogService,
  ) {}

  async forPlan(planId: string): Promise<PlanTracking> {
    return (await this.planData(planId)).tracking;
  }

  /** Matriz del plan y certificados de sus módulos (la exportación los necesita). */
  async planData(planId: string): Promise<PlanTrackingData> {
    const { plan, sections } = await this.plans.tree(planId);
    const modules: TrackedModule[] = sections.flatMap((section) =>
      section.modules
        .filter((module) => module.status === TrainingModuleStatus.Active)
        .map((module) => ({
          id: module.id,
          number: module.number,
          title: module.title,
          sectionTitle: section.title,
        })),
    );
    const teachers = await this.teachersOf(plan.areaId, plan.schoolYear);
    const moduleIds = modules.map((module) => module.id);
    const teacherIds = teachers.map((teacher) => teacher.id);

    let progress: TrackedProgress[] = [];
    let certificates: TrackedCertificate[] = [];
    if (moduleIds.length > 0 && teacherIds.length > 0) {
      [progress, certificates] = await Promise.all([
        this.repository.findProgress(moduleIds, teacherIds),
        this.repository.findModuleCertificates(moduleIds, teacherIds),
      ]);
    }
    const area = plan.areaId ? await this.areas.find(plan.areaId) : null;
    return {
      tracking: summarizePlan(
        {
          id: plan.id,
          name: plan.name,
          areaId: plan.areaId,
          areaName: area?.name ?? null,
          schoolYear: plan.schoolYear,
        },
        modules,
        teachers,
        progress,
      ),
      certificates: new Set(certificates.map((item) => `${item.teacherId}:${item.moduleId}`)),
    };
  }

  /**
   * CSV del seguimiento con una fila por docente y módulo (R24). Deja constancia en la bitácora
   * con el plan y el número de filas, nunca con su contenido.
   */
  async exportPlan(
    user: RequestUser,
    planId: string,
    now: Date = new Date(),
  ): Promise<{ fileName: string; content: string }> {
    const { tracking, certificates } = await this.planData(planId);
    const rows = exportRows(tracking, certificates);
    await this.audit.record({
      userId: user.id,
      role: user.role,
      type: AuditLogType.Training,
      action: 'Exportó el seguimiento de la formación',
      entity: 'plan_formacion',
      entityId: planId,
      dataAfter: { plan: tracking.plan.name, rows: rows.length },
    });
    return {
      fileName: exportFileName(tracking.plan.name, now),
      content: toCsv(EXPORT_HEADER, rows),
    };
  }

  /**
   * Plan General: todos los docentes activos. Plan de área: los docentes activos con asignación
   * activa en esa área en el año vigente. Un plan de otro año lectivo no tiene docentes que lo
   * vean, así que devuelve el plan sin ellos.
   */
  private async teachersOf(
    areaId: string | null,
    planYear: string | null,
  ): Promise<TrackedTeacher[]> {
    let currentYear: string | null = null;
    if (areaId !== null || planYear !== null) {
      currentYear = (await this.schoolYears.requireCurrent()).code;
    }
    if (planYear !== null && planYear !== currentYear) {
      return [];
    }
    const teachers = await this.assignments.teachersInScope(areaId, currentYear ?? '');
    return teachers.map((teacher) => ({ id: teacher.id, name: teacher.fullName }));
  }

  /** Avance de un docente por plan y módulo de su ruta, y sus certificados (R23). */
  async forTeacher(teacherId: string): Promise<TeacherTracking> {
    const teacher = await this.users.get(teacherId);
    const route = await this.route.routeOf(teacherId);
    const { items } = await this.certificates.listFor(teacherId);
    return {
      teacher: { id: teacher.id, name: teacher.fullName },
      schoolYear: route.schoolYear,
      plans: route.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        areaName: plan.areaName,
        modules: plan.sections.flatMap((section) =>
          section.modules.map((module) => ({
            id: module.id,
            number: module.number,
            title: module.title,
            sectionTitle: section.title,
            state: STATE_OF_TEACHER_MODULE[module.state],
            completedAt: module.completedAt,
            bestScore: module.bestScore,
          })),
        ),
      })),
      certificates: items,
    };
  }
}

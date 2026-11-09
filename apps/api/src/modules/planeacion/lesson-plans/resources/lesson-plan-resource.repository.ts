import type { CreateLessonPlanResourceInput, LessonPlanResource } from '@gns/shared';

export interface LessonPlanResourceRepository {
  /** Enlaces de la planeación en el orden del detalle (momento, creación). */
  findByPlan(lessonPlanId: string): Promise<LessonPlanResource[]>;
  findInPlan(lessonPlanId: string, resourceId: string): Promise<LessonPlanResource | null>;
  countByPlan(lessonPlanId: string): Promise<number>;
  create(lessonPlanId: string, input: CreateLessonPlanResourceInput): Promise<LessonPlanResource>;
  /** Borrado físico: el enlace es parte del borrador, no un registro pedagógico propio. */
  delete(resourceId: string): Promise<void>;
}

export const LESSON_PLAN_RESOURCE_REPOSITORY = Symbol('LESSON_PLAN_RESOURCE_REPOSITORY');

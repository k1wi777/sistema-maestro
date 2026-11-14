import type {
  Activity,
  ChallengeQuestion,
  ChallengeQuestionInput,
  CreateActivityInput,
  CreateSlideInput,
  Slide,
  TrainingActivityStatus,
  UpdateSlideInput,
} from '@gns/shared';

/** Cambios de una actividad ya validados contra el esquema de su tipo. */
export interface ActivityChanges {
  title?: string;
  isRequired?: boolean;
  instructions?: string | null;
  config?: Record<string, unknown>;
}

/** Diapositivas, preguntas con sus opciones y actividades de un módulo. */
export interface TrainingContentRepository {
  /** Bloquea la fila del módulo; `false` si no existe. */
  lockModule(moduleId: string): Promise<boolean>;

  listSlides(moduleId: string): Promise<Slide[]>;
  findSlide(moduleId: string, slideId: string): Promise<Slide | null>;
  createSlide(moduleId: string, input: CreateSlideInput): Promise<Slide>;
  updateSlide(slideId: string, input: UpdateSlideInput): Promise<Slide>;
  /** Borrado físico: la diapositiva es contenido editable que ningún progreso referencia. */
  deleteSlide(slideId: string): Promise<void>;
  listSlideIds(moduleId: string): Promise<string[]>;
  setSlideOrder(ids: readonly string[]): Promise<void>;

  listQuestions(moduleId: string): Promise<ChallengeQuestion[]>;
  findQuestion(moduleId: string, questionId: string): Promise<ChallengeQuestion | null>;
  createQuestion(moduleId: string, input: ChallengeQuestionInput): Promise<ChallengeQuestion>;
  /** Reemplaza el enunciado y las opciones de la pregunta; el llamador abre la transacción. */
  replaceQuestion(questionId: string, input: ChallengeQuestionInput): Promise<ChallengeQuestion>;
  /** Borrado físico de la pregunta y sus opciones. */
  deleteQuestion(questionId: string): Promise<void>;
  listQuestionIds(moduleId: string): Promise<string[]>;
  setQuestionOrder(ids: readonly string[]): Promise<void>;

  listActivities(moduleId: string): Promise<Activity[]>;
  findActivity(moduleId: string, activityId: string): Promise<Activity | null>;
  createActivity(moduleId: string, input: CreateActivityInput): Promise<Activity>;
  updateActivity(activityId: string, changes: ActivityChanges): Promise<Activity>;
  setActivityStatus(activityId: string, status: TrainingActivityStatus): Promise<Activity>;
  listActivityIds(moduleId: string): Promise<string[]>;
  setActivityOrder(ids: readonly string[]): Promise<void>;
}

export const TRAINING_CONTENT_REPOSITORY = Symbol('TRAINING_CONTENT_REPOSITORY');

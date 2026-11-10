import type {
  CreateTrainingModuleInput,
  CreateTrainingPlanInput,
  CreateTrainingSectionInput,
  TrainingModule,
  TrainingModuleStatus,
  TrainingPlan,
  TrainingPlanSummary,
  TrainingSection,
  TrainingSectionWithModules,
  UpdateTrainingModuleInput,
  UpdateTrainingPlanInput,
  UpdateTrainingSectionInput,
} from '@gns/shared';

/** Cuántos pasos tiene un módulo además del video y la presentación por enlace (regla de publicar). */
export interface ModuleContentCounts {
  slides: number;
  questions: number;
  activeActivities: number;
}

// ---------- Datos para la ruta y el módulo del docente ----------

export interface RouteActivityRow {
  id: string;
  type: string;
  title: string;
  isRequired: boolean;
  instructions: string | null;
  sortOrder: number;
  config: unknown;
  updatedAt: Date;
}

export interface RouteModuleRow {
  id: string;
  number: string | null;
  title: string;
  summary: string | null;
  sortOrder: number;
  videoUrl: string | null;
  presentationUrl: string | null;
  slideCount: number;
  questionCount: number;
  /** Solo las actividades `activo`, por orden. */
  activities: RouteActivityRow[];
}

export interface RouteSectionRow {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  /** Solo los módulos `activo`, por orden. */
  modules: RouteModuleRow[];
}

export interface RoutePlanRow {
  id: string;
  name: string;
  areaId: string | null;
  areaName: string | null;
  schoolYear: string | null;
  sections: RouteSectionRow[];
}

/** Módulo con lo necesario para decidir su visibilidad y armar su vista de juego. */
export interface TeacherModuleRow extends RouteModuleRow {
  status: TrainingModuleStatus;
  planId: string;
  planAreaId: string | null;
  planSchoolYear: string | null;
  sectionId: string;
  sectionTitle: string;
  videoTitle: string | null;
  approvalThreshold: number;
  secondsPerQuestion: number | null;
  slides: { id: string; title: string | null; keyIdeas: string | null }[];
}

export interface ActivityScopeRow {
  activity: RouteActivityRow & { moduleId: string; status: string };
  moduleStatus: TrainingModuleStatus;
  planAreaId: string | null;
  planSchoolYear: string | null;
}

/** Planes, secciones y módulos; lo único que toca la base para ellos y para las consultas de ruta. */
export interface TrainingPlanRepository {
  // Planes
  listPlans(): Promise<TrainingPlanSummary[]>;
  findPlan(id: string): Promise<TrainingPlan | null>;
  findPlanByAreaAndYear(
    areaId: string | null,
    schoolYear: string | null,
  ): Promise<TrainingPlan | null>;
  /** Serializa las altas y cambios de año de los planes (un plan por área y año). */
  lockPlanCreation(): Promise<void>;
  lockPlan(id: string): Promise<void>;
  createPlan(input: CreateTrainingPlanInput): Promise<TrainingPlan>;
  updatePlan(id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlan>;

  // Secciones
  findSection(id: string): Promise<TrainingSection | null>;
  listSectionsWithModules(planId: string): Promise<TrainingSectionWithModules[]>;
  lockSection(id: string): Promise<void>;
  createSection(planId: string, input: CreateTrainingSectionInput): Promise<TrainingSection>;
  updateSection(id: string, input: UpdateTrainingSectionInput): Promise<TrainingSection>;
  /** Borrado físico: la sección vacía es estructura editable que nada referencia. */
  deleteSection(id: string): Promise<void>;
  countModulesInSection(sectionId: string): Promise<number>;
  listSectionIds(planId: string): Promise<string[]>;
  setSectionOrder(ids: readonly string[]): Promise<void>;

  // Módulos
  findModule(id: string): Promise<TrainingModule | null>;
  lockModule(id: string): Promise<void>;
  createModule(section: TrainingSection, input: CreateTrainingModuleInput): Promise<TrainingModule>;
  updateModule(
    id: string,
    input: Omit<UpdateTrainingModuleInput, 'sectionId'>,
  ): Promise<TrainingModule>;
  /** Mueve el módulo al final de la sección destino. */
  moveModule(id: string, sectionId: string): Promise<TrainingModule>;
  listModuleIds(sectionId: string): Promise<string[]>;
  setModuleOrder(ids: readonly string[]): Promise<void>;
  setModuleStatus(id: string, status: TrainingModuleStatus): Promise<TrainingModule>;
  countContent(moduleId: string): Promise<ModuleContentCounts>;

  // Ruta del docente
  findRoutePlans(areaIds: readonly string[], schoolYear: string): Promise<RoutePlanRow[]>;
  findTeacherModule(moduleId: string): Promise<TeacherModuleRow | null>;
  findActivityScope(activityId: string): Promise<ActivityScopeRow | null>;
}

export const TRAINING_PLAN_REPOSITORY = Symbol('TRAINING_PLAN_REPOSITORY');

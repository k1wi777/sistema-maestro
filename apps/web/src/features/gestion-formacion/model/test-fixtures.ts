import type {
  Activity,
  TrainingModuleDetail,
  TrainingModuleOutline,
  TrainingPlanSummary,
  TrainingPlanTree,
  TrainingSectionWithModules,
} from '@gns/shared';

export const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const NOW = new Date('2026-11-15T12:00:00Z');

export function planSummary(
  n: number,
  overrides: Partial<TrainingPlanSummary> = {},
): TrainingPlanSummary {
  return {
    id: ID(n),
    areaId: null,
    name: 'Inducción institucional',
    schoolYear: null,
    createdAt: NOW,
    updatedAt: NOW,
    areaName: null,
    moduleCounts: { draft: 0, active: 0, outOfPlan: 0 },
    ...overrides,
  };
}

export function outline(
  n: number,
  overrides: Partial<TrainingModuleOutline> = {},
): TrainingModuleOutline {
  return {
    id: ID(n),
    number: String(n),
    sortOrder: n,
    title: `Módulo ${n}`,
    status: 'borrador',
    slideCount: 0,
    questionCount: 0,
    activityCount: 0,
    ...overrides,
  };
}

export function section(
  n: number,
  modules: TrainingModuleOutline[],
  title = `Parte ${n}`,
): TrainingSectionWithModules {
  return {
    id: ID(500 + n),
    planId: ID(1),
    title,
    subtitle: null,
    sortOrder: n,
    createdAt: NOW,
    updatedAt: NOW,
    modules,
  };
}

export function planTree(sections: TrainingSectionWithModules[]): TrainingPlanTree {
  const { id, areaId, name, schoolYear, createdAt, updatedAt } = planSummary(1);
  return { plan: { id, areaId, name, schoolYear, createdAt, updatedAt }, sections };
}

export function moduleDetail(overrides: Partial<TrainingModuleDetail> = {}): TrainingModuleDetail {
  return {
    id: ID(100),
    planId: ID(1),
    sectionId: ID(501),
    number: '1',
    sortOrder: 1,
    title: 'Módulo de prueba',
    summary: null,
    videoUrl: null,
    videoTitle: null,
    presentationUrl: null,
    videoSource: null,
    videoEmbedUrl: null,
    videoFile: null,
    presentationFile: null,
    status: 'borrador',
    approvalThreshold: 80,
    secondsPerQuestion: null,
    createdAt: NOW,
    updatedAt: NOW,
    slides: [],
    questions: [],
    activities: [],
    ...overrides,
  };
}

export function activity(n: number, overrides: Partial<Activity> = {}): Activity {
  return {
    id: ID(300 + n),
    type: 'conecta',
    sortOrder: n,
    title: `Actividad ${n}`,
    isRequired: false,
    instructions: null,
    status: 'activo',
    config: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

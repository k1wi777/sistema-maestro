import {
  TeacherModuleState,
  TrainingActivityType,
  type CertificateSummary,
  type TeacherActivitySummary,
  type TeacherModule,
  type TeacherModuleSummary,
  type TeacherRoute,
} from '@gns/shared';

/** Datos de prueba de la formación; solo los usan las pruebas de este módulo. */
export const uuid = (n: number): string =>
  `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

export const DATE = new Date('2026-11-09T10:00:00Z');

export function makeActivitySummary(
  overrides: Partial<TeacherActivitySummary> = {},
): TeacherActivitySummary {
  return {
    id: uuid(900),
    type: TrainingActivityType.Match,
    title: 'Conecta los conceptos',
    isRequired: true,
    completedAt: null,
    bestScore: null,
    stamps: null,
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<TeacherModuleSummary> = {}): TeacherModuleSummary {
  return {
    id: uuid(10),
    number: '1',
    title: 'Módulo uno',
    summary: null,
    videoSource: null,
    videoEmbedUrl: null,
    state: TeacherModuleState.Pending,
    steps: { video: false, presentation: false, challenge: false, activities: 0 },
    bestScore: null,
    videoViewedAt: null,
    presentationViewedAt: null,
    completedAt: null,
    activities: [],
    ...overrides,
  };
}

export function makeRoute(plans: TeacherModuleSummary[][]): TeacherRoute {
  return {
    schoolYear: '2026-2027',
    plans: plans.map((modules, index) => ({
      id: uuid(100 + index),
      name: `Plan ${index + 1}`,
      areaId: null,
      areaName: null,
      totals: {
        modules: modules.length,
        completed: modules.filter((item) => item.state === TeacherModuleState.Done).length,
      },
      sections: [{ id: uuid(200 + index), title: 'Parte I', subtitle: null, modules }],
    })),
  };
}

export function makeModule(overrides: Partial<TeacherModule> = {}): TeacherModule {
  return {
    id: uuid(10),
    planId: uuid(100),
    section: { id: uuid(200), title: 'Parte I' },
    number: '1',
    title: 'Módulo uno',
    summary: null,
    videoUrl: null,
    videoSource: null,
    videoEmbedUrl: null,
    videoFile: null,
    videoTitle: null,
    presentationUrl: null,
    presentationFile: null,
    slides: [],
    challenge: { questionCount: 0, approvalThreshold: 80, secondsPerQuestion: null },
    state: TeacherModuleState.Pending,
    progress: {
      videoViewedAt: null,
      presentationViewedAt: null,
      bestScore: null,
      bestPoints: null,
      attempts: 0,
      passedAt: null,
      completedAt: null,
    },
    activities: [],
    ...overrides,
  };
}

export function makeCertificate(overrides: Partial<CertificateSummary> = {}): CertificateSummary {
  return {
    id: uuid(300),
    kind: 'modulo',
    moduleId: uuid(10),
    title: 'Módulo uno',
    planName: 'Plan 1',
    code: 'ABCD-EFGH-JKLM-NPQR',
    issuedAt: DATE,
    ...overrides,
  };
}

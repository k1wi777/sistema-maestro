import type { LessonPlan, Review, SharedActivity } from '@gns/shared';

import type { FormValues } from './form-state';

/** Datos de prueba con nombres inventados; solo los usan las pruebas de este módulo. */
export function makeValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    periodId: 'p1',
    areaIds: '',
    dateFrom: '',
    dateTo: '',
    topic: '',
    expectedPerformance: '',
    learningCorner: '',
    curiocityStage: '',
    explorationMoment: '',
    developmentMoment: '',
    socializationMoment: '',
    closingMoment: '',
    resources: '',
    reasonableAdjustments: '',
    ...overrides,
  };
}

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

export function makePlan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    id: UUID_A,
    teacher: { id: UUID_B, fullName: 'Laura Demo' },
    grade: { id: UUID_C, name: 'Transition' },
    level: { id: UUID_A, name: 'Preescolar alto (KTF)' },
    areas: [{ id: UUID_B, name: 'English (CLIL)' }],
    period: { id: UUID_C, number: 1, schoolYear: '2026' },
    dateFrom: '2026-11-02',
    dateTo: '2026-11-06',
    topic: 'Sweet Home: my family',
    crossCuttingProject: 'Ciudad+',
    expectedPerformance: 'Presenta a su familia.',
    learningCorner: 'Sweet Home',
    curiocityStage: null,
    explorationMoment: 'Canción de saludo.',
    developmentMoment: 'Títeres de la familia.',
    socializationMoment: null,
    closingMoment: null,
    resources: 'Títeres, parlante.',
    reasonableAdjustments: 'Apoyo visual paso a paso.',
    status: 'borrador',
    submittedAt: null,
    linkedResources: [],
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-02T15:00:00Z'),
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<SharedActivity> = {}): SharedActivity {
  return {
    id: UUID_A,
    author: { id: UUID_B, fullName: 'Camila Demo' },
    level: { id: UUID_A, name: 'Preescolar alto (KTF)' },
    area: { id: UUID_B, name: 'English (CLIL)' },
    grade: { id: UUID_C, name: 'Transition' },
    learningCorner: 'Sweet Home',
    activityType: 'juego',
    title: 'Family puppets show',
    objective: 'Presentar a la familia con títeres.',
    durationMinutes: 30,
    materials: 'Títeres de papel.',
    steps: '1. Armamos los títeres.\n2. Presentamos.',
    link: 'https://www.canva.com/',
    isFavorite: false,
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-01T15:00:00Z'),
    ...overrides,
  };
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: UUID_A,
    action: 'observaciones',
    comment: 'Agrega el cierre.',
    reviewer: { id: UUID_B, fullName: 'Coordinadora Demo' },
    date: new Date('2026-11-05T15:00:00Z'),
    adjustedFields: [],
    changes: [],
    ...overrides,
  };
}

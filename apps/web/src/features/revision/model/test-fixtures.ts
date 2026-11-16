import type { LessonPlan, Review } from '@gns/shared';

/** Datos de prueba con nombres inventados; solo los usan las pruebas de este módulo. */
export const UUID_A = '11111111-1111-4111-8111-111111111111';
export const UUID_B = '22222222-2222-4222-8222-222222222222';
export const UUID_C = '33333333-3333-4333-8333-333333333333';
export const UUID_D = '44444444-4444-4444-8444-444444444444';

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
    closingMoment: 'Cierre con juego.',
    resources: 'Títeres, parlante.',
    reasonableAdjustments: 'Apoyo visual paso a paso.',
    status: 'enviada',
    submittedAt: new Date('2026-11-07T15:00:00Z'),
    linkedResources: [],
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-07T15:00:00Z'),
    ...overrides,
  };
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: UUID_A,
    action: 'observaciones',
    comment: 'Agrega el cierre.',
    reviewer: { id: UUID_D, fullName: 'Coordinadora Demo' },
    date: new Date('2026-11-05T15:00:00Z'),
    adjustedFields: [],
    changes: [],
    ...overrides,
  };
}

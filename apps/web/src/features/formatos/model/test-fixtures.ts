import type { FieldJournalDay, JournalAnnotation, ObserverNote, Review } from '@gns/shared';

/** Datos de prueba con nombres de pila inventados; solo los usan las pruebas de este módulo. */
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const UUID_D = '44444444-4444-4444-8444-444444444444';

export const ANNOTATION_ID = UUID_D;

export function makeAnnotation(overrides: Partial<JournalAnnotation> = {}): JournalAnnotation {
  return {
    id: ANNOTATION_ID,
    teacher: { id: UUID_B, fullName: 'Laura Demo' },
    area: { id: UUID_C, name: 'Pre-ciencias' },
    eventType: 'positivo',
    students: ['Sofía', 'Matías'],
    description: 'Clasificaron objetos con el imán y explicaron sus hallazgos.',
    actions: null,
    reflection: null,
    status: 'lista',
    readyAt: new Date('2026-11-09T15:40:00Z'),
    sent: false,
    isMine: true,
    observation: null,
    createdAt: new Date('2026-11-09T14:00:00Z'),
    updatedAt: new Date('2026-11-09T15:40:00Z'),
    ...overrides,
  };
}

export function makeJournalDay(overrides: Partial<FieldJournalDay> = {}): FieldJournalDay {
  return {
    id: UUID_A,
    status: 'en_curso',
    createdAt: new Date('2026-11-09T14:00:00Z'),
    updatedAt: new Date('2026-11-09T15:40:00Z'),
    schoolYear: '2026-2027',
    level: { id: UUID_C, name: 'Preescolar alto (KTF)' },
    grade: { id: UUID_C, name: 'Transition' },
    group: { id: UUID_D, name: 'Transition 1' },
    date: '2026-11-09',
    homeroomTeacher: { id: UUID_B, fullName: 'Laura Demo' },
    submittedAt: null,
    readyCount: 1,
    expectedCount: 3,
    contributors: [],
    missing: [],
    annotations: [makeAnnotation()],
    generalObservation: null,
    signature: null,
    history: [],
    viewer: {
      isParticipant: true,
      isHomeroomTeacher: true,
      areas: [{ id: UUID_C, name: 'Pre-ciencias' }],
      canAnnotate: true,
      canSubmit: true,
      canResubmit: false,
      canVoid: true,
      canReview: false,
      blockedReason: null,
    },
    ...overrides,
  };
}

export function makeNote(overrides: Partial<ObserverNote> = {}): ObserverNote {
  return {
    id: UUID_A,
    teacher: { id: UUID_B, fullName: 'Laura Demo' },
    grade: { id: UUID_C, name: 'Transition' },
    studentFirstName: 'Tomás',
    date: '2026-11-05',
    type: 'tipo_ii',
    description: 'Empujó a un compañero en la fila.',
    studentVersion: null,
    pedagogicalStrategies: null,
    actions: null,
    familyInformed: false,
    followUp: null,
    status: 'borrador',
    createdAt: new Date('2026-11-05T15:00:00Z'),
    updatedAt: new Date('2026-11-05T15:00:00Z'),
    ...overrides,
  };
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: UUID_A,
    action: 'observaciones',
    comment: 'Agrega las acciones.',
    reviewer: { id: UUID_B, fullName: 'Coordinadora Demo' },
    date: new Date('2026-11-07T15:00:00Z'),
    adjustedFields: [],
    changes: [],
    ...overrides,
  };
}

import type { FieldJournal, FieldJournalEntry, ObserverNote, Review } from '@gns/shared';

/** Datos de prueba con nombres de pila inventados; solo los usan las pruebas de este módulo. */
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const UUID_D = '44444444-4444-4444-8444-444444444444';

export const ENTRY_ID = UUID_D;

export function makeEntry(overrides: Partial<FieldJournalEntry> = {}): FieldJournalEntry {
  return {
    id: ENTRY_ID,
    date: '2026-11-06',
    lesson: 'English · Sweet Home',
    eventType: 'positivo',
    students: ['Sofía', 'Matías'],
    description: 'Presentó a su familia en inglés.',
    actions: null,
    reflection: null,
    createdAt: new Date('2026-11-06T15:00:00Z'),
    updatedAt: new Date('2026-11-06T15:00:00Z'),
    ...overrides,
  };
}

export function makeJournal(overrides: Partial<FieldJournal> = {}): FieldJournal {
  return {
    id: UUID_A,
    teacher: { id: UUID_B, fullName: 'Laura Demo' },
    grade: { id: UUID_C, name: 'Transition' },
    period: { id: UUID_D, number: 1, schoolYear: '2026-2027' },
    status: 'borrador',
    submittedAt: null,
    entryCount: 1,
    entries: [makeEntry()],
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-06T15:00:00Z'),
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

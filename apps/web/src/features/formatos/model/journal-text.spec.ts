import {
  contributionSummary,
  journalPrintTitle,
  joinNames,
  missingText,
  myObservationsText,
  pendingContributorsText,
  readOnlyMessage,
} from './journal-text';
import { makeAnnotation, makeJournalDay } from './test-fixtures';

const person = (id: string, fullName: string) => ({ id, fullName });

describe('journal text', () => {
  it('summarizes the contributions of the group', () => {
    expect(contributionSummary(3, 5)).toBe('3 de 5 docentes con anotación lista');
    expect(contributionSummary(1, 1)).toBe('1 de 1 docente con anotación lista');
  });

  it('joins names in Spanish', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Luis'])).toBe('Ana y Luis');
    expect(joinNames(['Ana', 'Luis', 'Eva'])).toBe('Ana, Luis y Eva');
  });

  it('names who has no ready annotation and why, as in the confirmation of the board', () => {
    const text = pendingContributorsText([
      { teacher: person('a', 'Laura Méndez'), status: 'ready' },
      { teacher: person('b', 'Diego Herrera'), status: 'draft' },
      { teacher: person('c', 'Julián Castro'), status: 'none' },
    ]);
    expect(text).toBe('Diego Herrera (en borrador) y Julián Castro (sin aporte)');
    expect(pendingContributorsText([{ teacher: person('a', 'Laura'), status: 'ready' }])).toBe('');
  });

  it('lists who did not contribute with their subjects', () => {
    expect(
      missingText([
        { teacher: person('c', 'Julián Castro'), areas: ['Música'], status: 'none' },
        { teacher: person('d', 'Ana Ruiz'), areas: [], status: 'draft' },
      ]),
    ).toBe('Julián Castro (Música) y Ana Ruiz');
  });

  it('titles the PDF with the group and the date and never with students', () => {
    const journal = makeJournalDay({
      annotations: [makeAnnotation({ students: ['Sofía', 'Matías'] })],
    });
    const title = journalPrintTitle(journal);
    expect(title).toBe('Diario de campo F-PA-05 – Transition 1 – 2026-11-09');
    expect(title).not.toContain('Sofía');
    expect(title).not.toContain('Matías');
  });

  it('tells the teacher about the observations of coordination', () => {
    expect(myObservationsText(0)).toBeNull();
    expect(myObservationsText(1)).toBe('Coordinación dejó 1 observación a tu anotación');
    expect(myObservationsText(2)).toBe('Coordinación dejó 2 observaciones a tus anotaciones');
  });

  it('explains the read-only states', () => {
    expect(readOnlyMessage('en_curso')).toBeNull();
    expect(readOnlyMessage(null)).toBeNull();
    expect(readOnlyMessage('enviado')?.tone).toBe('info');
    expect(readOnlyMessage('revisado')?.tone).toBe('success');
    expect(readOnlyMessage('anulado')?.tone).toBe('warning');
  });
});

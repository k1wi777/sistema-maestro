import { journalPrintTitle } from './journal-print';
import { makeEntry, makeJournal } from './test-fixtures';

describe('journal print title', () => {
  it('names the document after the format, the grade and the period', () => {
    expect(journalPrintTitle(makeJournal())).toBe(
      'Diario de campo F-PA-05 – Transition – Periodo 1',
    );
  });

  it('never includes the students of the entries', () => {
    const journal = makeJournal({ entries: [makeEntry({ students: ['Sofía', 'Matías'] })] });
    const title = journalPrintTitle(journal);
    expect(title).not.toContain('Sofía');
    expect(title).not.toContain('Matías');
  });
});

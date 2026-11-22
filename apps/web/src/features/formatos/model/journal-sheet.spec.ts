import { buildJournalSheet, gradeCellText, JOURNAL_SHEET_MIN_ROWS } from './journal-sheet';
import { makeAnnotation, makeJournalDay } from './test-fixtures';

describe('journal sheet', () => {
  it('prints the grade with the group, adding the grade when the group name lacks it', () => {
    expect(gradeCellText('7°', '7° 1')).toBe('GRADO: 7° 1');
    expect(gradeCellText('Kinder', 'Red 1')).toBe('GRADO: Kinder · Red 1');
  });

  it('prints one row per annotation that is not a draft and fills up to 7 rows', () => {
    const sheet = buildJournalSheet(
      makeJournalDay({
        annotations: [
          makeAnnotation({ id: 'a', description: 'Sofía lista.' }),
          makeAnnotation({ id: 'b', status: 'borrador', description: 'Sin enviar.' }),
          makeAnnotation({ id: 'c', status: 'observada', description: 'Por corregir.' }),
        ],
      }),
    );
    expect(sheet.rows.filter((row) => row.key !== null).map((row) => row.description)).toEqual([
      'Sofía lista.',
      'Por corregir.',
    ]);
    expect(sheet.rows).toHaveLength(JOURNAL_SHEET_MIN_ROWS);
    expect(sheet.rows[0]).toMatchObject({
      date: '09/11/2026',
      className: 'Pre-ciencias',
      teacher: 'Laura Demo',
    });
    expect(sheet.rows[6]).toEqual({
      key: null,
      date: '',
      className: '',
      teacher: '',
      description: '',
    });
  });

  it('does not cut rows when there are more than 7 annotations', () => {
    const annotations = Array.from({ length: 9 }, (_, index) =>
      makeAnnotation({ id: `id-${index}` }),
    );
    expect(buildJournalSheet(makeJournalDay({ annotations })).rows).toHaveLength(9);
  });

  it('shows the period, level and school year of the header', () => {
    const sheet = buildJournalSheet(makeJournalDay());
    expect(sheet).toMatchObject({
      schoolYear: '2026-2027',
      level: 'Preescolar alto (KTF)',
      period: '3',
      gradeCell: 'GRADO: Transition 1',
    });
    expect(buildJournalSheet(makeJournalDay({ period: null })).period).toBe('');
  });

  it('leaves «revisado por» blank until the journal is approved, then names the reviewer and date', () => {
    expect(buildJournalSheet(makeJournalDay()).reviewedBy).toBe('');
    const reviewed = makeJournalDay({
      signature: {
        reviewer: { id: '11111111-1111-4111-8111-111111111111', fullName: 'Elena Coordinadora' },
        date: new Date('2026-11-10T15:00:00Z'),
      },
    });
    expect(buildJournalSheet(reviewed).reviewedBy).toBe('Elena Coordinadora 10/11/2026');
  });
});

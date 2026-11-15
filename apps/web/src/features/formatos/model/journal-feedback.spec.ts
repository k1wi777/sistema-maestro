import { journalEntryChangeField } from '@gns/shared';

import { adjustedEntriesLabel, journalFeedback, journalReviewLine } from './journal-feedback';
import { ENTRY_ID, makeReview } from './test-fixtures';

const OTHER_ENTRY = '55555555-5555-4555-8555-555555555555';

describe('journal feedback', () => {
  it('has no decision and no adjusted entries without reviews', () => {
    expect(journalFeedback([])).toEqual({ decision: null, adjustedEntryIds: [] });
  });

  it('counts each adjusted entry once, however many columns changed', () => {
    const date = new Date('2026-11-07T15:00:00Z');
    const feedback = journalFeedback([
      makeReview({
        action: 'ajuste',
        comment: null,
        date,
        adjustedFields: [
          journalEntryChangeField(ENTRY_ID, 'descripcion'),
          journalEntryChangeField(ENTRY_ID, 'acciones'),
          journalEntryChangeField(OTHER_ENTRY, 'clase'),
          'columna_desconocida',
        ],
      }),
      makeReview({ date }),
    ]);
    expect(feedback.adjustedEntryIds.sort()).toEqual([ENTRY_ID, OTHER_ENTRY].sort());
    expect(adjustedEntriesLabel(feedback.adjustedEntryIds.length)).toBe(
      'Coordinación ajustó 2 registros',
    );
  });

  it('words the adjusted count in singular and omits it at zero', () => {
    expect(adjustedEntriesLabel(1)).toBe('Coordinación ajustó 1 registro');
    expect(adjustedEntriesLabel(0)).toBeNull();
  });

  it('reports pending review while the sheet is submitted or a draft', () => {
    const empty = journalFeedback([]);
    expect(journalReviewLine('enviada', empty)).toEqual({
      kind: 'text',
      text: 'Pendiente de revisión por coordinación',
    });
    expect(journalReviewLine('borrador', empty)).toEqual({
      kind: 'text',
      text: 'Sin enviar a coordinación',
    });
  });

  it('shows the decision only while it is current', () => {
    const feedback = journalFeedback([makeReview({ comment: 'Falta una acción.' })]);
    const reviewed = journalReviewLine('observaciones', feedback);
    expect(reviewed.kind).toBe('decision');
    // Una hoja devuelta y reenviada vuelve a estar pendiente: la decisión vieja ya no manda.
    expect(journalReviewLine('enviada', feedback).kind).toBe('text');
  });
});

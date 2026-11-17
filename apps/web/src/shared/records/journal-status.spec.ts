import { AnnotationStatus, JournalStatus } from '@gns/shared';

import {
  ANNOTATION_STATUS_INFO,
  JOURNAL_STATUS_INFO,
  JOURNAL_STATUS_ORDER,
  journalStatusFromUrl,
} from './journal-status';

describe('journal status', () => {
  it('describes every journal status exactly once, in filter order', () => {
    expect(new Set(JOURNAL_STATUS_ORDER)).toEqual(new Set(Object.values(JournalStatus)));
    expect(Object.keys(JOURNAL_STATUS_INFO).sort()).toEqual([...JOURNAL_STATUS_ORDER].sort());
  });

  it('uses the labels of the board for the journal and its annotations', () => {
    expect(JOURNAL_STATUS_INFO.enviado.label).toBe('Enviado · pendiente de revisión');
    expect(JOURNAL_STATUS_INFO.enviado.shortLabel).toBe('Pendiente de revisión');
    expect(JOURNAL_STATUS_INFO.anulado.tone).toBe('danger');
    expect(Object.keys(ANNOTATION_STATUS_INFO).sort()).toEqual(
      Object.values(AnnotationStatus).sort(),
    );
    expect(ANNOTATION_STATUS_INFO.observada.label).toBe('Por corregir');
  });

  it('accepts only known statuses from the URL', () => {
    expect(journalStatusFromUrl('en_curso')).toBe('en_curso');
    expect(journalStatusFromUrl('borrador')).toBeUndefined();
    expect(journalStatusFromUrl(null)).toBeUndefined();
  });
});

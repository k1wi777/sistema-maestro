import { JournalEventType, ObserverNoteType } from '@gns/shared';

import {
  JOURNAL_EVENT_INFO,
  JOURNAL_EVENT_ORDER,
  OBSERVER_TYPE_INFO,
  OBSERVER_TYPE_ORDER,
  requiresConvivenciaRoute,
} from './labels';

describe('labels', () => {
  it('describes every journal event type and observer type exactly once', () => {
    expect(new Set(JOURNAL_EVENT_ORDER)).toEqual(new Set(Object.values(JournalEventType)));
    expect(Object.keys(JOURNAL_EVENT_INFO).sort()).toEqual([...JOURNAL_EVENT_ORDER].sort());
    expect(new Set(OBSERVER_TYPE_ORDER)).toEqual(new Set(Object.values(ObserverNoteType)));
    expect(Object.keys(OBSERVER_TYPE_INFO).sort()).toEqual([...OBSERVER_TYPE_ORDER].sort());
  });

  it('uses the board wording', () => {
    expect(JOURNAL_EVENT_INFO.mejorar.label).toBe('Aspecto por mejorar');
    expect(OBSERVER_TYPE_INFO.tipo_ii.label).toBe('Situación de convivencia Tipo II');
  });

  it('asks for the convivencia route only for type II and III', () => {
    expect(OBSERVER_TYPE_ORDER.filter(requiresConvivenciaRoute)).toEqual(['tipo_ii', 'tipo_iii']);
    expect(requiresConvivenciaRoute('')).toBe(false);
  });
});

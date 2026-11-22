import { ObserverNoteType } from '@gns/shared';

import {
  JOURNAL_FORMAT_NOTES,
  OBSERVER_TYPE_INFO,
  OBSERVER_TYPE_ORDER,
  requiresConvivenciaRoute,
} from './labels';

describe('labels', () => {
  it('describes every observer type exactly once', () => {
    expect(new Set(OBSERVER_TYPE_ORDER)).toEqual(new Set(Object.values(ObserverNoteType)));
    expect(Object.keys(OBSERVER_TYPE_INFO).sort()).toEqual([...OBSERVER_TYPE_ORDER].sort());
  });

  it('uses the board wording', () => {
    expect(OBSERVER_TYPE_INFO.tipo_ii.label).toBe('Situación de convivencia Tipo II');
  });

  it('keeps the two notes of the F-PA-05 format', () => {
    expect(JOURNAL_FORMAT_NOTES).toEqual([
      'La descripción del evento debe incluir el estudiante implicado.',
      'Definir las acciones en caso de registrar aspectos por mejorar.',
    ]);
  });

  it('asks for the convivencia route only for type II and III', () => {
    expect(OBSERVER_TYPE_ORDER.filter(requiresConvivenciaRoute)).toEqual(['tipo_ii', 'tipo_iii']);
    expect(requiresConvivenciaRoute('')).toBe(false);
  });
});

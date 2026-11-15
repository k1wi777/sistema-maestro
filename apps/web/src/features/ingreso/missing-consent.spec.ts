import type { ConsentBox } from '@/shared/legal';

import { missingConsentMessage } from './missing-consent';

const boxes: ConsentBox[] = [
  { key: 'policy', label: 'a', shortName: 'lectura del aviso y la política' },
  { key: 'authorization', label: 'b', shortName: 'autorización' },
  { key: 'terms', label: 'c', shortName: 'términos de uso' },
];

describe('missingConsentMessage', () => {
  it('nombra todas si no hay ninguna marcada', () => {
    expect(
      missingConsentMessage(boxes, { policy: false, authorization: false, terms: false }),
    ).toBe('Falta marcar: lectura del aviso y la política, autorización y términos de uso.');
  });

  it('nombra solo las que faltan', () => {
    expect(missingConsentMessage(boxes, { policy: true, authorization: false, terms: false })).toBe(
      'Falta marcar: autorización y términos de uso.',
    );
    expect(missingConsentMessage(boxes, { policy: true, authorization: true, terms: false })).toBe(
      'Falta marcar: términos de uso.',
    );
  });

  it('no dice nada si están todas', () => {
    expect(
      missingConsentMessage(boxes, { policy: true, authorization: true, terms: true }),
    ).toBeNull();
  });
});

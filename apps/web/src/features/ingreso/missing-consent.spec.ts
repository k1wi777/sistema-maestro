import type { ConsentBox } from '@/shared/legal';

import {
  allChecked,
  missingConsentMessage,
  someChecked,
  toggleAll,
  type ConsentChecks,
} from './missing-consent';

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

const none: ConsentChecks = { policy: false, authorization: false, terms: false };
const some: ConsentChecks = { policy: true, authorization: false, terms: false };
const all: ConsentChecks = { policy: true, authorization: true, terms: true };

describe('toggleAll', () => {
  it('marca todas desde ninguna', () => {
    expect(toggleAll(boxes, none)).toEqual(all);
  });

  it('marca todas si solo hay algunas', () => {
    expect(toggleAll(boxes, some)).toEqual(all);
  });

  it('desmarca todas si ya están todas', () => {
    expect(toggleAll(boxes, all)).toEqual(none);
  });
});

describe('estado de «Marcar todo»', () => {
  it('es mixto solo con algunas marcadas', () => {
    expect(someChecked(boxes, none)).toBe(false);
    expect(someChecked(boxes, some)).toBe(true);
    expect(someChecked(boxes, all)).toBe(false);
  });

  it('está marcada solo con todas', () => {
    expect(allChecked(boxes, none)).toBe(false);
    expect(allChecked(boxes, some)).toBe(false);
    expect(allChecked(boxes, all)).toBe(true);
  });
});

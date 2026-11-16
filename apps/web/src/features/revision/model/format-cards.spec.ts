import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { pendingLabel, REVIEW_FORMAT_CARDS } from './format-cards';

// apps/web/src/features/revision/model → apps/web/src/app
const APP = join(__dirname, '..', '..', '..', 'app', '(coordinacion)');

describe('tarjetas de formatos de coordinación', () => {
  it('van en el orden Planeaciones, Diarios de campo y Observadores', () => {
    expect(REVIEW_FORMAT_CARDS.map((card) => card.title)).toEqual([
      'Planeaciones',
      'Diarios de campo',
      'Observadores',
    ]);
  });

  it('cada tarjeta lleva un conteo de pendientes distinto', () => {
    const keys = REVIEW_FORMAT_CARDS.map((card) => card.pending);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(REVIEW_FORMAT_CARDS.map((card) => [card.href] as const))('%s tiene su página', (href) => {
    expect(existsSync(join(APP, href, 'page.tsx'))).toBe(true);
  });

  it('escribe los pendientes en singular y plural', () => {
    expect(pendingLabel(0)).toBe('0 pendientes');
    expect(pendingLabel(1)).toBe('1 pendiente');
    expect(pendingLabel(4)).toBe('4 pendientes');
  });
});

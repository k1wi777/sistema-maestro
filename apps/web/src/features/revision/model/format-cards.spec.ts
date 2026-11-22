import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { pendingLabel, reviewFormatCards, totalLabel } from './format-cards';
import { revisionPaths } from './paths';

// apps/web/src/features/revision/model → apps/web/src/app
const APP = join(__dirname, '..', '..', '..', 'app');
const GROUPS = {
  '/coordinacion': '(coordinacion)',
  '/administracion': '(administracion)',
} as const;

describe('tarjetas de formatos de coordinación y administración', () => {
  const cards = reviewFormatCards(revisionPaths('/coordinacion'), false);

  it('van en el orden Planeaciones, Diarios de campo y Observadores', () => {
    expect(cards.map((card) => card.title)).toEqual([
      'Planeaciones',
      'Diarios de campo',
      'Observadores',
    ]);
  });

  it('cada tarjeta lleva un conteo de pendientes distinto', () => {
    const keys = cards.map((card) => card.pending);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(
    (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).flatMap((view) =>
      reviewFormatCards(revisionPaths(view), false).map((card) => [view, card.href] as const),
    ),
  )('%s: %s tiene su página', (view, href) => {
    expect(existsSync(join(APP, GROUPS[view], href, 'page.tsx'))).toBe(true);
  });

  it('en administración todas las tarjetas dicen «Solo consulta»', () => {
    for (const card of reviewFormatCards(revisionPaths('/administracion'), true)) {
      expect(card.description).toBe('Todos los grados · Solo consulta');
      expect(card.href.startsWith('/administracion/formatos')).toBe(true);
    }
  });

  it('escribe los pendientes y los totales en singular y plural', () => {
    expect(pendingLabel(0)).toBe('0 pendientes en tus grados');
    expect(pendingLabel(1)).toBe('1 pendiente en tus grados');
    expect(pendingLabel(4)).toBe('4 pendientes en tus grados');
    expect(totalLabel(1)).toBe('1 registro');
    expect(totalLabel(23)).toBe('23 registros');
  });
});

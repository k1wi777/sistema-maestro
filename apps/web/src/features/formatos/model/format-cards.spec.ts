import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FORMAT_CARDS } from './format-cards';

// apps/web/src/features/formatos/model → apps/web/src/app
const APP = join(__dirname, '..', '..', '..', 'app', '(docente)');

describe('tarjetas de formatos del docente', () => {
  it('van en el orden Planeación, Diario, Observador y PIAR', () => {
    expect(FORMAT_CARDS.map((card) => card.id)).toEqual([
      'planeacion',
      'diario',
      'observador',
      'piar',
    ]);
  });

  it('PIAR está marcado «pronto» y sin enlace', () => {
    const piar = FORMAT_CARDS.find((card) => card.id === 'piar');
    expect(piar).toMatchObject({ soon: true });
    expect(piar?.href).toBeUndefined();
  });

  it.each(FORMAT_CARDS.filter((card) => card.href).map((card) => [card.href ?? ''] as const))(
    '%s tiene su página',
    (href) => {
      expect(existsSync(join(APP, href, 'page.tsx'))).toBe(true);
    },
  );
});

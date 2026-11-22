import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LEGACY_REDIRECTS, nextRedirects } from './legacy-redirects';

// apps/web/src/shared/shell → apps/web/src/app
const APP = join(__dirname, '..', '..', 'app');

const pageFile = (href: string) => {
  const group = href.startsWith('/docente')
    ? '(docente)'
    : href.startsWith('/administracion')
      ? '(administracion)'
      : '(coordinacion)';
  return join(APP, group, href, 'page.tsx');
};

const pathOf = (url: string) => url.split('?')[0] ?? url;

describe('redirecciones de rutas anteriores', () => {
  it('cubren cada ruta antigua de la planificación', () => {
    const covered = LEGACY_REDIRECTS.map((rule) => rule.example);
    expect(covered).toEqual(
      expect.arrayContaining([
        '/docente/planeacion',
        '/docente/planeacion/nueva',
        '/coordinacion/planeaciones',
        '/coordinacion/planeaciones/abc',
        '/docente/formatos?pestana=observador',
        '/docente/formatos?estado=enviada',
        '/coordinacion/formatos?tipo=observador',
        '/coordinacion/formatos?tipo=diario',
        '/coordinacion/formatos?estado=enviada',
        '/coordinacion/bitacora',
        '/coordinacion/grados-y-areas',
      ]),
    );
  });

  it.each(LEGACY_REDIRECTS.map((rule) => [rule.example, rule] as const))(
    '%s redirige a una ruta con página',
    (_example, rule) => {
      const base = rule.source.replace('/:path*', '');
      expect(pathOf(rule.example).startsWith(base)).toBe(true);
      expect(
        rule.destination
          .replace('/:path*', '')
          .startsWith(rule.exampleTarget.split('/').slice(0, 4).join('/')),
      ).toBe(true);
      expect(existsSync(pageFile(rule.exampleTarget))).toBe(true);
    },
  );

  it('la ruta de destino nunca es una ruta antigua (sin cadenas de redirección)', () => {
    const sources = new Set(LEGACY_REDIRECTS.map((rule) => rule.source.replace('/:path*', '')));
    for (const rule of LEGACY_REDIRECTS) {
      const destination = rule.destination.replace('/:path*', '');
      const old = [
        '/docente/planeacion',
        '/coordinacion/planeaciones',
        '/coordinacion/bitacora',
        '/coordinacion/grados-y-areas',
      ];
      expect(old).not.toContain(destination);
      // Las reglas con consulta salen de /…/formatos, que no es destino de ninguna regla.
      expect(sources.has(destination) && rule.has === undefined).toBe(false);
    }
  });

  it('son temporales (307) y conservan las condiciones de consulta', () => {
    const rules = nextRedirects();
    expect(rules).toHaveLength(LEGACY_REDIRECTS.length);
    expect(rules.every((rule) => rule.permanent === false)).toBe(true);
    const observer = rules.find((rule) => rule.destination === '/docente/formatos/observador');
    expect(observer).toMatchObject({
      has: [{ type: 'query', key: 'pestana', value: 'observador' }],
    });
    const journal = rules.find((rule) => rule.destination === '/docente/formatos/diario');
    expect(journal).toMatchObject({ missing: [{ type: 'query', key: 'pestana' }] });
  });
});

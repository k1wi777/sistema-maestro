import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { VIEWS, firstSectionHref, isActiveSection, sectionByHref, sectionsOf } from './navigation';

// apps/web/src/shared/shell → apps/web/src/app
const APP = join(__dirname, '..', '..', 'app');

const pageFile = (href: string) =>
  join(APP, href.startsWith('/docente') ? '(docente)' : '(coordinacion)', href, 'page.tsx');

describe('isActiveSection', () => {
  it.each([
    ['/docente/formacion', '/docente/formacion', true],
    ['/docente/formacion/modulo-1', '/docente/formacion', true],
    ['/docente/formatos', '/docente/formacion', false],
    ['/coordinacion/docentes', '/coordinacion/docente', false],
    ['/docente', '/docente/formacion', false],
  ])('%s frente a %s', (pathname, href, expected) => {
    expect(isActiveSection(pathname, href)).toBe(expected);
  });
});

describe('menú de las vistas', () => {
  const hrefs = Object.values(VIEWS).flatMap((view) => sectionsOf(view).map((s) => s.href));

  it('declara las secciones del tablero', () => {
    expect(hrefs).toEqual([
      '/docente/formacion',
      '/docente/planeacion',
      '/docente/formatos',
      '/docente/asistente',
      '/coordinacion/planeaciones',
      '/coordinacion/formatos',
      '/coordinacion/bitacora',
      '/coordinacion/docentes',
      '/coordinacion/planes',
      '/coordinacion/avance',
      '/coordinacion/asistente',
    ]);
  });

  it.each(hrefs)('%s tiene su página', (href) => {
    expect(existsSync(pageFile(href))).toBe(true);
  });

  it('PIAR está marcado «pronto» y sin enlace', () => {
    const piar = VIEWS['/docente'].groups[0]?.sections.find((s) => s.label.startsWith('PIAR'));
    expect(piar).toMatchObject({ soon: true });
    expect(piar?.href).toBeUndefined();
  });

  it('cada vista empieza en su primera sección', () => {
    expect(firstSectionHref(VIEWS['/docente'])).toBe('/docente/formacion');
    expect(firstSectionHref(VIEWS['/coordinacion'])).toBe('/coordinacion/planeaciones');
  });

  it('busca la vista de una sección y falla con una ruta desconocida', () => {
    expect(sectionByHref('/coordinacion/avance').view.path).toBe('/coordinacion');
    expect(() => sectionByHref('/docente/otra')).toThrow();
  });
});

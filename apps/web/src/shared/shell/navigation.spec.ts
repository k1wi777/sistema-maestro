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
    ['/docente/formatos/planeacion/abc', '/docente/formatos', true],
    ['/docente/formatos/diario', '/docente/formatos', true],
    ['/coordinacion/formatos/planeaciones/abc', '/coordinacion/formatos', true],
    ['/coordinacion/formatos', '/coordinacion/formatos/planeaciones', false],
  ])('%s frente a %s', (pathname, href, expected) => {
    expect(isActiveSection(pathname, href)).toBe(expected);
  });
});

describe('menú de las vistas', () => {
  const hrefs = Object.values(VIEWS).flatMap((view) => sectionsOf(view).map((s) => s.href));

  it('declara las secciones del tablero', () => {
    expect(hrefs).toEqual([
      '/docente/formacion',
      '/docente/formatos',
      '/docente/asistente',
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

  it('PIAR, Planeación GNS y Planeaciones ya no están en el menú: viven dentro de Formatos', () => {
    const labels = Object.values(VIEWS).flatMap((view) =>
      view.groups.flatMap((group) => group.sections.map((section) => section.label)),
    );
    expect(labels).not.toContain('PIAR · Inclusión');
    expect(labels).not.toContain('Planeación GNS');
    expect(labels).not.toContain('Planeaciones');
    expect(labels).toContain('Formatos');
  });

  it('cada vista empieza en su primera sección', () => {
    expect(firstSectionHref(VIEWS['/docente'])).toBe('/docente/formacion');
    expect(firstSectionHref(VIEWS['/coordinacion'])).toBe('/coordinacion/formatos');
  });

  it('busca la vista de una sección y falla con una ruta desconocida', () => {
    expect(sectionByHref('/coordinacion/avance').view.path).toBe('/coordinacion');
    expect(() => sectionByHref('/docente/otra')).toThrow();
  });
});

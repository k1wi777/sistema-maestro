import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { VIEWS, firstSectionHref, isActiveSection, sectionByHref, sectionsOf } from './navigation';

// apps/web/src/shared/shell → apps/web/src/app
const APP = join(__dirname, '..', '..', 'app');

const GROUPS = {
  '/docente': '(docente)',
  '/coordinacion': '(coordinacion)',
  '/administracion': '(administracion)',
} as const;

const pageFile = (href: string) => {
  const view = `/${href.split('/')[1]}` as keyof typeof GROUPS;
  return join(APP, GROUPS[view], href, 'page.tsx');
};

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
      '/coordinacion/docentes',
      '/coordinacion/planes',
      '/coordinacion/avance',
      '/coordinacion/asistente',
      '/administracion/formatos',
      '/administracion/bitacora',
      '/administracion/docentes',
      '/administracion/grados-y-areas',
      '/administracion/planes',
      '/administracion/avance',
      '/administracion/asistente',
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

  it('la bitácora y «Grados y áreas» son solo de administración', () => {
    const coordination = sectionsOf(VIEWS['/coordinacion']).map((section) => section.href);
    expect(coordination).not.toContain('/coordinacion/bitacora');
    expect(coordination).not.toContain('/coordinacion/grados-y-areas');
    expect(existsSync(join(APP, '(coordinacion)', 'coordinacion', 'bitacora'))).toBe(false);
    expect(existsSync(join(APP, '(coordinacion)', 'coordinacion', 'grados-y-areas'))).toBe(false);
  });

  it('el menú de administración sigue los grupos del tablero', () => {
    expect(
      VIEWS['/administracion'].groups.map((group) => [
        group.title,
        group.sections.map((section) => section.label),
      ]),
    ).toEqual([
      ['Seguimiento', ['Formatos', 'Bitácora de actividad']],
      [
        'Gestión',
        [
          'Docentes y asignaciones',
          'Grados y áreas',
          'Planes de formación',
          'Avance en la formación',
          'Asistente',
        ],
      ],
    ]);
  });

  it('cada vista empieza en su primera sección', () => {
    expect(firstSectionHref(VIEWS['/docente'])).toBe('/docente/formacion');
    expect(firstSectionHref(VIEWS['/coordinacion'])).toBe('/coordinacion/formatos');
    expect(firstSectionHref(VIEWS['/administracion'])).toBe('/administracion/formatos');
  });

  it('busca la vista de una sección y falla con una ruta desconocida', () => {
    expect(sectionByHref('/coordinacion/avance').view.path).toBe('/coordinacion');
    expect(sectionByHref('/administracion/bitacora').view.path).toBe('/administracion');
    expect(() => sectionByHref('/docente/otra')).toThrow();
  });
});

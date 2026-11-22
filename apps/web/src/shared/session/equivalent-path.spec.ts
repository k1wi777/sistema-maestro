import { equivalentPath } from './equivalent-path';

describe('equivalentPath', () => {
  it.each([
    ['/coordinacion/formatos', 'administrador', '/administracion/formatos'],
    [
      '/coordinacion/formatos/planeaciones/abc',
      'administrador',
      '/administracion/formatos/planeaciones/abc',
    ],
    ['/coordinacion/docentes', 'administrador', '/administracion/docentes'],
    ['/coordinacion/planes/modulos/m1', 'administrador', '/administracion/planes/modulos/m1'],
    ['/administracion/avance', 'coordinador', '/coordinacion/avance'],
    ['/administracion/formatos/diario/d1', 'coordinador', '/coordinacion/formatos/diario/d1'],
  ] as const)('%s para %s → %s', (pathname, role, expected) => {
    expect(equivalentPath(pathname, role)).toBe(expected);
  });

  it.each([
    // La bitácora y «Grados y áreas» son solo de administración.
    ['/administracion/bitacora', 'coordinador'],
    ['/administracion/grados-y-areas', 'coordinador'],
    // Ya es la vista del rol.
    ['/coordinacion/formatos', 'coordinador'],
    ['/administracion/bitacora', 'administrador'],
    // Un docente no tiene equivalente en las vistas de personal, ni al revés.
    ['/coordinacion/formatos', 'docente'],
    ['/administracion/formatos', 'docente'],
    ['/docente/formatos', 'coordinador'],
    ['/docente/formatos', 'administrador'],
    // Rutas que no son de una vista, o sin sección conocida.
    ['/ingreso', 'administrador'],
    ['/coordinacion/inexistente', 'administrador'],
    ['/coordinacionx/formatos', 'administrador'],
  ] as const)('%s para %s no tiene equivalente', (pathname, role) => {
    expect(equivalentPath(pathname, role)).toBeNull();
  });
});

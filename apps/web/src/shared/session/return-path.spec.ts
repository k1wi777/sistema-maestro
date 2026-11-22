import { consentPath, loginPath, safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it.each([
    ['/docente', 'docente', '/docente'],
    ['/docente/formatos/planeacion?x=1', 'docente', '/docente/formatos/planeacion?x=1'],
    ['/coordinacion', 'coordinador', '/coordinacion'],
    [
      '/coordinacion/formatos/planeaciones/abc?x=1',
      'coordinador',
      '/coordinacion/formatos/planeaciones/abc?x=1',
    ],
    ['/administracion/bitacora', 'administrador', '/administracion/bitacora'],
    // Ruta equivalente entre coordinación y administración (conserva la consulta).
    [
      '/coordinacion/formatos/planeaciones/abc?x=1',
      'administrador',
      '/administracion/formatos/planeaciones/abc?x=1',
    ],
    ['/administracion/planes#a', 'coordinador', '/coordinacion/planes#a'],
  ] as const)('acepta %s para %s', (value, role, expected) => {
    expect(safeReturnPath(value, role)).toBe(expected);
  });

  it.each([
    'https://evil.test/docente',
    'http://evil.test',
    '//evil.test',
    '//evil.test/docente',
    '/\\evil.test',
    '/docente\\..\\evil',
    '\\docente',
    'docente',
    '/',
    '/ingreso',
    '/muestra',
    '/docentes',
    '/docente-x',
    '/%2Fevil.test',
    '/docente\n//evil.test',
    'javascript:alert(1)',
    '',
  ])('ignora %j', (value) => {
    expect(safeReturnPath(value, 'docente')).toBe('/docente');
  });

  it('ignora una ruta que el rol no alcanza y no tiene equivalente', () => {
    expect(safeReturnPath('/coordinacion', 'docente')).toBe('/docente');
    expect(safeReturnPath('/docente', 'coordinador')).toBe('/coordinacion');
    expect(safeReturnPath('/docente', 'administrador')).toBe('/administracion');
    // Bitácora y «Grados y áreas» no existen en coordinación.
    expect(safeReturnPath('/administracion/bitacora', 'coordinador')).toBe('/coordinacion');
    expect(safeReturnPath('/administracion/grados-y-areas', 'coordinador')).toBe('/coordinacion');
  });

  it('usa la vista propia de cada rol si no hay valor', () => {
    expect(safeReturnPath(null, 'docente')).toBe('/docente');
    expect(safeReturnPath(null, 'coordinador')).toBe('/coordinacion');
    expect(safeReturnPath(undefined, 'administrador')).toBe('/administracion');
  });
});

describe('consentPath', () => {
  it('lleva la ruta actual como retorno', () => {
    expect(consentPath('/docente/formatos/planeacion')).toBe(
      '/ingreso?volver=%2Fdocente%2Fformatos%2Fplaneacion',
    );
  });
});

describe('loginPath', () => {
  it('lleva la ruta actual como retorno', () => {
    expect(loginPath({ status: 'anonymous' }, '/coordinacion')).toBe(
      '/ingreso?volver=%2Fcoordinacion',
    );
  });

  it('añade el motivo si la sesión terminó', () => {
    expect(loginPath({ status: 'ended' }, '/docente')).toBe(
      '/ingreso?motivo=sesion-vencida&volver=%2Fdocente',
    );
  });

  it('no lleva retorno tras cerrar sesión', () => {
    expect(loginPath({ status: 'anonymous', signedOut: true }, '/docente')).toBe('/ingreso');
  });
});

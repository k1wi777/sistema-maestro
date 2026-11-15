import { consentPath, loginPath, safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it.each([
    ['/docente', 'docente', '/docente'],
    ['/docente/planeacion?x=1', 'docente', '/docente/planeacion?x=1'],
    ['/coordinacion', 'coordinador', '/coordinacion'],
    ['/docente', 'coordinador', '/docente'],
    ['/docente', 'administrador', '/docente'],
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

  it('ignora una ruta que el rol no alcanza', () => {
    expect(safeReturnPath('/coordinacion', 'docente')).toBe('/docente');
  });

  it('usa la vista propia si no hay valor', () => {
    expect(safeReturnPath(null, 'coordinador')).toBe('/coordinacion');
    expect(safeReturnPath(undefined, 'administrador')).toBe('/coordinacion');
  });
});

describe('consentPath', () => {
  it('lleva la ruta actual como retorno', () => {
    expect(consentPath('/docente/planeacion')).toBe('/ingreso?volver=%2Fdocente%2Fplaneacion');
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

import {
  PROTECTED_ROUTES,
  decideAccess,
  homePathFor,
  roleCanUse,
  type AccessDecision,
} from './route-access';
import {
  applyResolution,
  endSession,
  initialsOf,
  requireConsent,
  type CurrentUser,
  type SessionState,
} from './session-state';

const user = (role: CurrentUser['role']): CurrentUser => ({
  id: '00000000-0000-4000-8000-000000000000',
  fullName: 'Persona de prueba',
  email: 'prueba@demo.gns.test',
  role,
});
const auth = (
  role: CurrentUser['role'],
  consent: 'accepted' | 'pending' = 'accepted',
): SessionState => ({
  status: 'authenticated',
  user: user(role),
  consent,
  policyVersion: '2026-2',
});

describe('decideAccess', () => {
  const teacher = PROTECTED_ROUTES['/docente'];
  const coordination = PROTECTED_ROUTES['/coordinacion'];
  const administration = PROTECTED_ROUTES['/administracion'];
  const cases: [string, SessionState, readonly string[], AccessDecision][] = [
    ['cargando', { status: 'loading' }, teacher, 'loading'],
    ['API caída', { status: 'unavailable' }, teacher, 'unavailable'],
    ['sin sesión', { status: 'anonymous' }, teacher, 'redirect-login'],
    ['sesión terminada', { status: 'ended' }, coordination, 'redirect-login'],
    ['docente en docente', auth('docente'), teacher, 'allowed'],
    ['docente en coordinación', auth('docente'), coordination, 'forbidden'],
    ['docente en administración', auth('docente'), administration, 'forbidden'],
    // Sin jerarquía: ni coordinación ni administración entran en la vista docente.
    ['coordinador en docente', auth('coordinador'), teacher, 'forbidden'],
    ['coordinador en coordinación', auth('coordinador'), coordination, 'allowed'],
    ['coordinador en administración', auth('coordinador'), administration, 'forbidden'],
    ['administrador en docente', auth('administrador'), teacher, 'forbidden'],
    ['administrador en coordinación', auth('administrador'), coordination, 'forbidden'],
    ['administrador en administración', auth('administrador'), administration, 'allowed'],
    ['aviso pendiente', auth('docente', 'pending'), teacher, 'consent-pending'],
    ['rol fuera y aviso pendiente', auth('docente', 'pending'), coordination, 'forbidden'],
  ];
  it.each(cases)('%s', (_label, state, allowed, expected) => {
    expect(decideAccess(state, allowed as never)).toBe(expected);
  });
});

describe('roleCanUse', () => {
  it('cada vista admite solo el rol propio', () => {
    expect(roleCanUse('/docente', 'docente')).toBe(true);
    expect(roleCanUse('/docente', 'coordinador')).toBe(false);
    expect(roleCanUse('/coordinacion', 'administrador')).toBe(false);
    expect(roleCanUse('/administracion', 'administrador')).toBe(true);
  });
});

describe('homePathFor', () => {
  it('asigna la vista propia de cada rol', () => {
    expect(homePathFor('docente')).toBe('/docente');
    expect(homePathFor('coordinador')).toBe('/coordinacion');
    expect(homePathFor('administrador')).toBe('/administracion');
  });
});

describe('transiciones de sesión', () => {
  it('endSession y requireConsent solo afectan a una sesión activa', () => {
    expect(endSession(auth('docente'))).toEqual({ status: 'ended' });
    expect(endSession({ status: 'anonymous' })).toEqual({ status: 'anonymous' });
    expect(requireConsent(auth('docente'))).toEqual(auth('docente', 'pending'));
    expect(requireConsent({ status: 'loading' })).toEqual({ status: 'loading' });
  });

  it('una resolución anónima no borra el estado ended', () => {
    expect(applyResolution({ status: 'ended' }, { kind: 'anonymous' }, true)).toEqual({
      status: 'ended',
    });
    expect(applyResolution({ status: 'loading' }, { kind: 'anonymous' }, false)).toEqual({
      status: 'anonymous',
    });
  });

  it('la revalidación en segundo plano sin API conserva la sesión', () => {
    expect(applyResolution(auth('docente'), { kind: 'unavailable' }, true)).toEqual(
      auth('docente'),
    );
    expect(applyResolution({ status: 'loading' }, { kind: 'unavailable' }, false)).toEqual({
      status: 'unavailable',
    });
  });

  it('una resolución autenticada aplica el rol y el aviso vigentes', () => {
    expect(
      applyResolution(
        auth('docente'),
        {
          kind: 'authenticated',
          user: user('coordinador'),
          consent: 'pending',
          policyVersion: '2026-4',
        },
        true,
      ),
    ).toEqual({ ...auth('coordinador', 'pending'), policyVersion: '2026-4' });
  });
});

describe('initialsOf', () => {
  it.each([
    ['Marcela Rojas', 'MR'],
    ['laura méndez', 'LM'],
    ['Saide Del Carmen Barguil', 'SB'],
    ['Cher', 'C'],
    ['  ', ''],
  ])('%j → %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

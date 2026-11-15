import { availableViews, decideAccess, homePathFor, type AccessDecision } from './route-access';
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
  const cases: [string, SessionState, 'docente' | 'coordinador', AccessDecision][] = [
    ['cargando', { status: 'loading' }, 'docente', 'loading'],
    ['API caída', { status: 'unavailable' }, 'docente', 'unavailable'],
    ['sin sesión', { status: 'anonymous' }, 'docente', 'redirect-login'],
    ['sesión terminada', { status: 'ended' }, 'coordinador', 'redirect-login'],
    ['docente en docente', auth('docente'), 'docente', 'allowed'],
    ['docente en coordinación', auth('docente'), 'coordinador', 'forbidden'],
    ['coordinador en docente', auth('coordinador'), 'docente', 'allowed'],
    ['coordinador en coordinación', auth('coordinador'), 'coordinador', 'allowed'],
    ['administrador en docente', auth('administrador'), 'docente', 'allowed'],
    ['administrador en coordinación', auth('administrador'), 'coordinador', 'allowed'],
    ['aviso pendiente', auth('docente', 'pending'), 'docente', 'consent-pending'],
    ['rol insuficiente y aviso pendiente', auth('docente', 'pending'), 'coordinador', 'forbidden'],
  ];
  it.each(cases)('%s', (_label, state, required, expected) => {
    expect(decideAccess(state, required)).toBe(expected);
  });
});

describe('availableViews', () => {
  it('el docente solo alcanza su vista', () => {
    expect(availableViews('docente')).toEqual(['/docente']);
  });

  it('coordinación y administración alcanzan las dos vistas', () => {
    expect(availableViews('coordinador')).toEqual(['/docente', '/coordinacion']);
    expect(availableViews('administrador')).toEqual(['/docente', '/coordinacion']);
  });
});

describe('homePathFor', () => {
  it('asigna la vista propia de cada rol', () => {
    expect(homePathFor('docente')).toBe('/docente');
    expect(homePathFor('coordinador')).toBe('/coordinacion');
    expect(homePathFor('administrador')).toBe('/coordinacion');
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
          policyVersion: '2026-3',
        },
        true,
      ),
    ).toEqual({ ...auth('coordinador', 'pending'), policyVersion: '2026-3' });
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

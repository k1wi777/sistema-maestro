import { safeReturnPath } from '@/shared/session/return-path';
import { homePathFor } from '@/shared/session/route-access';
import { VIEWS, firstSectionHref } from '@/shared/shell/navigation';
import type { CurrentUser, SessionState } from '@/shared/session';

import { ingresoView } from './ingreso-view';

const rules = {
  safeReturnPath,
  homePath: homePathFor,
  homeSection: (role: CurrentUser['role']) => firstSectionHref(VIEWS[homePathFor(role)]),
};

const user = (role: CurrentUser['role']): CurrentUser => ({
  id: '00000000-0000-4000-8000-000000000000',
  fullName: 'Persona de prueba',
  email: 'prueba@demo.gns.test',
  role,
});
const auth = (role: CurrentUser['role'], consent: 'accepted' | 'pending'): SessionState => ({
  status: 'authenticated',
  user: user(role),
  consent,
  policyVersion: '2026-2',
});

describe('ingresoView', () => {
  it('mientras carga, el formulario sin poder enviarse', () => {
    expect(ingresoView({ status: 'loading' }, null, rules)).toEqual({ kind: 'form', busy: true });
  });

  it.each([
    { status: 'anonymous' },
    { status: 'anonymous', signedOut: true },
    { status: 'ended' },
    { status: 'unavailable' },
  ] as const)('sin sesión (%j): el formulario', (state) => {
    expect(ingresoView(state, null, rules)).toEqual({ kind: 'form', busy: false });
  });

  it('con el aviso pendiente, el aviso, aunque haya ruta de retorno', () => {
    expect(ingresoView(auth('docente', 'pending'), '/docente', rules)).toEqual({
      kind: 'consent',
    });
    expect(ingresoView(auth('coordinador', 'pending'), null, rules)).toEqual({ kind: 'consent' });
  });

  it.each([
    ['docente', '/docente/formacion'],
    ['coordinador', '/coordinacion/formatos'],
    ['administrador', '/administracion/formatos'],
  ] as const)('%s va directo a la primera sección de su vista', (role, to) => {
    expect(ingresoView(auth(role, 'accepted'), null, rules)).toEqual({ kind: 'navigate', to });
  });

  it('un retorno seguro tiene prioridad', () => {
    expect(ingresoView(auth('docente', 'accepted'), '/docente/formatos/planeacion', rules)).toEqual(
      {
        kind: 'navigate',
        to: '/docente/formatos/planeacion',
      },
    );
  });

  it('una ruta de coordinación guardada lleva a la equivalente de administración', () => {
    expect(
      ingresoView(
        auth('administrador', 'accepted'),
        '/coordinacion/formatos/planeaciones/abc?estado=enviada',
        rules,
      ),
    ).toEqual({
      kind: 'navigate',
      to: '/administracion/formatos/planeaciones/abc?estado=enviada',
    });
  });

  it.each(['https://evil.test', '//evil.test', '/coordinacion', '/administracion', '/muestra'])(
    'ignora el retorno %s y no lo usa para el docente',
    (returnTo) => {
      expect(ingresoView(auth('docente', 'accepted'), returnTo, rules)).toEqual({
        kind: 'navigate',
        to: '/docente/formacion',
      });
    },
  );

  it('sin retorno seguro, coordinación y administración van a su primera sección (no hay selección de vista)', () => {
    expect(ingresoView(auth('coordinador', 'accepted'), 'https://evil.test', rules)).toEqual({
      kind: 'navigate',
      to: '/coordinacion/formatos',
    });
    expect(ingresoView(auth('administrador', 'accepted'), '/docente', rules)).toEqual({
      kind: 'navigate',
      to: '/administracion/formatos',
    });
  });
});

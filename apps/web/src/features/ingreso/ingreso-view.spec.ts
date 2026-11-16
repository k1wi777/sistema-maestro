import { availableViews } from '@/shared/session/route-access';
import { safeReturnPath } from '@/shared/session/return-path';
import type { CurrentUser, SessionState } from '@/shared/session';

import { ingresoView } from './ingreso-view';

const rules = { safeReturnPath, availableViews };

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

  it('el docente va directo a su vista', () => {
    expect(ingresoView(auth('docente', 'accepted'), null, rules)).toEqual({
      kind: 'navigate',
      to: '/docente',
    });
  });

  it('un retorno seguro tiene prioridad', () => {
    expect(
      ingresoView(auth('coordinador', 'accepted'), '/docente/formatos/planeacion', rules),
    ).toEqual({
      kind: 'navigate',
      to: '/docente/formatos/planeacion',
    });
  });

  it.each(['https://evil.test', '//evil.test', '/coordinacion', '/muestra'])(
    'ignora el retorno %s y no lo usa para el docente',
    (returnTo) => {
      expect(ingresoView(auth('docente', 'accepted'), returnTo, rules)).toEqual({
        kind: 'navigate',
        to: '/docente',
      });
    },
  );

  it.each(['coordinador', 'administrador'] as const)(
    '%s sin retorno seguro elige su vista',
    (role) => {
      expect(ingresoView(auth(role, 'accepted'), null, rules)).toEqual({ kind: 'chooser' });
      expect(ingresoView(auth(role, 'accepted'), 'https://evil.test', rules)).toEqual({
        kind: 'chooser',
      });
    },
  );
});

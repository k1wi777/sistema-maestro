import type { User } from '@gns/shared';

import { EMPTY_USER_FORM, apiFieldErrors, validateCreate, validateUpdate } from './user-form';

const original: User = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Laura Demo',
  email: 'laura@demo.gns.test',
  role: 'docente',
  status: 'activo',
  createdById: null,
  createdAt: new Date('2026-11-01T15:00:00Z'),
};

describe('validateCreate', () => {
  it('acepta un alta válida y normaliza el correo', () => {
    const result = validateCreate({
      fullName: ' Prueba Demo ',
      email: 'Prueba@Demo.GNS.test',
      role: 'docente',
      password: 'una-clave-larga-1',
    });
    expect(result).toMatchObject({
      ok: true,
      input: { fullName: 'Prueba Demo', email: 'prueba@demo.gns.test', role: 'docente' },
    });
  });

  it('señala cada campo inválido, también un rol sin elegir', () => {
    const result = validateCreate({ ...EMPTY_USER_FORM, email: 'no-es-correo', password: 'corta' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['email', 'fullName', 'password', 'role']);
      expect(result.errors.role).toBe('Elige un rol.');
    }
  });
});

describe('validateUpdate', () => {
  const same = {
    fullName: original.fullName,
    email: original.email,
    role: original.role,
    password: '',
  };

  it('sin cambios no envía nada', () => {
    expect(validateUpdate(same, original)).toEqual({ ok: false, errors: {}, unchanged: true });
  });

  it('envía solo los campos cambiados', () => {
    expect(validateUpdate({ ...same, role: 'coordinador' }, original)).toEqual({
      ok: true,
      input: { role: 'coordinador' },
    });
  });

  it('rechaza un correo inválido', () => {
    const result = validateUpdate({ ...same, email: 'x' }, original);
    expect(result.ok).toBe(false);
  });
});

describe('apiFieldErrors', () => {
  it('toma solo los campos del formulario', () => {
    expect(
      apiFieldErrors([
        { field: 'email', reason: 'ya existe' },
        { field: 'otro', reason: 'x' },
      ]),
    ).toEqual({ email: 'Ya existe' });
  });
});

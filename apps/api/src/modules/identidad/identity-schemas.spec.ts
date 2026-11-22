import {
  ALL_ROLES,
  acceptConsentSchema,
  changePasswordSchema,
  changeUserRoleSchema,
  createUserSchema,
  loginSchema,
  passwordSchema,
  updateUserSchema,
  UserRole,
} from '@gns/shared';

describe('ALL_ROLES', () => {
  it('lista los tres roles en orden fijo, sin jerarquía', () => {
    expect(ALL_ROLES).toEqual([UserRole.Teacher, UserRole.Coordinator, UserRole.Administrator]);
  });
});

describe('passwordSchema', () => {
  it('acepta de 12 a 128 caracteres y rechaza el resto', () => {
    expect(passwordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});

describe('createUserSchema', () => {
  const valid = {
    fullName: '  Docente Prueba ',
    email: '  Docente.Prueba@GNS.test ',
    role: UserRole.Teacher,
    password: 'x'.repeat(12),
  };

  it('normaliza el correo y el nombre', () => {
    const parsed = createUserSchema.parse(valid);
    expect(parsed.email).toBe('docente.prueba@gns.test');
    expect(parsed.fullName).toBe('Docente Prueba');
  });

  it('rechaza roles desconocidos, correos inválidos y campos extra', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'root' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, email: 'no-es-correo' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, status: 'activo' }).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('exige al menos un campo y no repone valores', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.parse({ fullName: 'Ana Demo' })).toEqual({ fullName: 'Ana Demo' });
  });

  it('ya no acepta el rol: cambiarlo es PUT /users/:id/role', () => {
    expect(updateUserSchema.safeParse({ role: UserRole.Coordinator }).success).toBe(false);
    expect(changeUserRoleSchema.parse({ role: UserRole.Coordinator })).toEqual({
      role: UserRole.Coordinator,
    });
    expect(changeUserRoleSchema.safeParse({ role: 'dios' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('rememberMe es falso por omisión y el correo se normaliza', () => {
    const parsed = loginSchema.parse({ email: ' A@B.co ', password: 'corta' });
    expect(parsed).toEqual({ email: 'a@b.co', password: 'corta', rememberMe: false });
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x', rememberMe: true }).rememberMe).toBe(
      true,
    );
  });

  it('rechaza una contraseña vacía o enorme', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(129) }).success).toBe(
      false,
    );
  });
});

describe('changePasswordSchema', () => {
  it('aplica la política solo a la contraseña nueva', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'vieja', newPassword: 'n'.repeat(12) })
        .success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'vieja', newPassword: 'corta' }).success,
    ).toBe(false);
  });
});

describe('acceptConsentSchema', () => {
  const valid = {
    policyVersion: '2026-1',
    items: { policy: true, authorization: true, terms: true },
  };

  it('accepts the three boxes checked', () => {
    expect(acceptConsentSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['policy', 'authorization', 'terms'])(
    'rejects %s missing or unchecked, naming the field',
    (key) => {
      const missing = { ...valid.items } as Record<string, unknown>;
      delete missing[key];
      const unchecked = { ...valid.items, [key]: false };

      for (const items of [missing, unchecked]) {
        const result = acceptConsentSchema.safeParse({ ...valid, items });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toEqual(['items', key]);
      }
    },
  );

  it('rejects unknown fields and an empty or oversized version', () => {
    expect(acceptConsentSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(acceptConsentSchema.safeParse({ ...valid, policyVersion: '' }).success).toBe(false);
    expect(acceptConsentSchema.safeParse({ ...valid, policyVersion: 'v'.repeat(21) }).success).toBe(
      false,
    );
  });
});

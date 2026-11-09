import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, passwordSchema } from './password';
import { emailSchema, userRoleSchema } from './user';

/**
 * Ingreso con correo y contraseña. La contraseña no aplica la política de longitud mínima:
 * una credencial antigua nunca debe poder distinguirse de una incorrecta.
 */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ error: 'debe ser texto' })
      .min(1, 'no puede estar vacía')
      .max(PASSWORD_MAX_LENGTH, `debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`),
    rememberMe: z.boolean({ error: 'debe ser verdadero o falso' }).default(false),
  })
  .strict();
export type LoginInput = z.output<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'debe ser texto' })
      .min(1, 'no puede estar vacía')
      .max(PASSWORD_MAX_LENGTH, `debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`),
    newPassword: passwordSchema,
  })
  .strict();
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

/** Usuario de la sesión actual. */
export const currentUserSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  role: userRoleSchema,
});
export type CurrentUserProfile = z.output<typeof currentUserSchema>;

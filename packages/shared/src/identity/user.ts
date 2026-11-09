import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { UserRole, UserStatus } from '../constants/user';
import { passwordSchema } from './password';

export const USER_EMAIL_MAX_LENGTH = 160;
export const USER_NAME_MAX_LENGTH = 120;

/** Correo normalizado (sin espacios y en minúsculas): el `@unique` de la base basta para evitar duplicados. */
export const emailSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .toLowerCase()
  .max(USER_EMAIL_MAX_LENGTH, `debe tener como máximo ${USER_EMAIL_MAX_LENGTH} caracteres`)
  .pipe(z.email('debe ser un correo válido'));

const fullNameSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .min(1, 'no puede estar vacío')
  .max(USER_NAME_MAX_LENGTH, `debe tener como máximo ${USER_NAME_MAX_LENGTH} caracteres`);

const roleSchema = z.enum(Object.values(UserRole) as [UserRole, ...UserRole[]], {
  error: 'rol no permitido',
});
const statusSchema = z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]], {
  error: 'estado no permitido',
});

/** Usuario tal como lo devuelve la API de gestión; nunca incluye credenciales. */
export const userSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  role: roleSchema,
  status: statusSchema,
  createdById: z.uuid().nullable(),
  createdAt: isoDateTimeSchema,
});
export type User = z.output<typeof userSchema>;

export const createUserSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    role: roleSchema,
    password: passwordSchema,
  })
  .strict();
export type CreateUserInput = z.output<typeof createUserSchema>;

// Sin defaults: un PATCH vacío no debe reponer valores.
export const updateUserSchema = z
  .object({ fullName: fullNameSchema, email: emailSchema, role: roleSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'debe incluir al menos un campo' });
export type UpdateUserInput = z.output<typeof updateUserSchema>;

export const updateUserStatusSchema = z.object({ status: statusSchema }).strict();
export type UpdateUserStatusInput = z.output<typeof updateUserStatusSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema }).strict();
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;

export const userRoleSchema = roleSchema;
export const userStatusSchema = statusSchema;

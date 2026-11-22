import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
  type UserRole,
} from '@gns/shared';

export interface UserFormValues {
  fullName: string;
  email: string;
  role: UserRole | '';
  /** Contraseña inicial: solo vive en el formulario abierto y no se guarda en ningún otro lugar. */
  password: string;
}

export type UserFormField = keyof UserFormValues;
export type UserFormErrors = Partial<Record<UserFormField, string>>;

export const EMPTY_USER_FORM: UserFormValues = { fullName: '', email: '', role: '', password: '' };

const FIELDS: readonly string[] = ['fullName', 'email', 'role', 'password'];

interface Issues {
  issues: { path: PropertyKey[]; message: string }[];
}

function errorsOf(error: Issues): UserFormErrors {
  const errors: UserFormErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    if (FIELDS.includes(field) && !errors[field as UserFormField]) {
      errors[field as UserFormField] = capitalize(issue.message);
    }
  }
  return errors;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Pasa a error de campo lo que la API rechazó (`errors` del cuerpo 400). */
export function apiFieldErrors(
  errors: { field: string; reason: string }[] | undefined,
): UserFormErrors {
  const result: UserFormErrors = {};
  for (const { field, reason } of errors ?? []) {
    if (FIELDS.includes(field) && !result[field as UserFormField]) {
      result[field as UserFormField] = capitalize(reason);
    }
  }
  return result;
}

export type CreateResult =
  { ok: true; input: CreateUserInput } | { ok: false; errors: UserFormErrors };

/** Valida el alta con el esquema compartido; un rol sin elegir se reporta como error del campo. */
export function validateCreate(values: UserFormValues): CreateResult {
  const parsed = createUserSchema.safeParse({
    fullName: values.fullName,
    email: values.email,
    role: values.role === '' ? undefined : values.role,
    password: values.password,
  });
  if (parsed.success) {
    return { ok: true, input: parsed.data };
  }
  const errors = errorsOf(parsed.error);
  if (values.role === '') {
    errors.role = 'Elige un rol.';
  }
  return { ok: false, errors };
}

export type UpdateResult =
  | {
      ok: true;
      /** Nombre y correo cambiados (`PATCH`); `null` si solo cambia el rol. */
      input: UpdateUserInput | null;
      /** Rol nuevo (`PUT /users/:id/role`, con aviso de consecuencias); `null` si no cambia. */
      role: UserRole | null;
    }
  | { ok: false; errors: UserFormErrors; unchanged: boolean };

/** Valida la edición: nombre y correo cambiados por un lado y el rol, si cambia, por otro. */
export function validateUpdate(values: UserFormValues, original: User): UpdateResult {
  const changes: Record<string, string> = {};
  const role = values.role !== '' && values.role !== original.role ? values.role : null;
  if (values.fullName.trim() !== original.fullName) {
    changes.fullName = values.fullName;
  }
  if (values.email.trim().toLowerCase() !== original.email) {
    changes.email = values.email;
  }
  if (Object.keys(changes).length === 0) {
    return role === null
      ? { ok: false, errors: {}, unchanged: true }
      : { ok: true, input: null, role };
  }
  const parsed = updateUserSchema.safeParse(changes);
  return parsed.success
    ? { ok: true, input: parsed.data, role }
    : { ok: false, errors: errorsOf(parsed.error), unchanged: false };
}

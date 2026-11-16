'use client';

import { UserRole, type User } from '@gns/shared';
import { useState, type FormEvent } from 'react';

import type { ApiResult } from '@/shared/api';
import { roleLabel } from '@/shared/session';
import { Button, Dialog, Notice, Select, TextInput } from '@/shared/ui';

import { createUser, updateUser } from '../api/users';
import {
  EMPTY_USER_FORM,
  apiFieldErrors,
  validateCreate,
  validateUpdate,
  type UserFormErrors,
  type UserFormValues,
} from '../model/user-form';
import styles from './user-form-dialog.module.css';

const ROLE_OPTIONS = Object.values(UserRole).map((role) => ({
  value: role,
  label: roleLabel(role).charAt(0).toUpperCase() + roleLabel(role).slice(1),
}));

interface UserFormDialogProps {
  /** `null` crea un usuario; con un usuario, lo edita. */
  user: User | null;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Alta y edición de un usuario. Se monta solo mientras está abierto (así la contraseña inicial
 * nunca sobrevive al cierre) y conserva lo escrito cuando la API rechaza el envío.
 */
export function UserFormDialog({ user, onSaved, onClose }: UserFormDialogProps) {
  const [values, setValues] = useState<UserFormValues>(
    user
      ? { fullName: user.fullName, email: user.email, role: user.role, password: '' }
      : EMPTY_USER_FORM,
  );
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change<K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    let send: (() => Promise<ApiResult<User>>) | null = null;
    if (user) {
      const validation = validateUpdate(values, user);
      if (validation.ok) {
        send = () => updateUser(user.id, validation.input);
      } else {
        setErrors(validation.errors);
        if (validation.unchanged) {
          setFailure('No hay cambios para guardar.');
        }
      }
    } else {
      const validation = validateCreate(values);
      if (validation.ok) {
        send = () => createUser(validation.input);
      } else {
        setErrors(validation.errors);
      }
    }
    if (!send) {
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await send();
    setBusy(false);
    if (result.ok) {
      onSaved();
      return;
    }
    const fieldErrors = apiFieldErrors('errors' in result.error ? result.error.errors : undefined);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      setFailure(result.error.message);
    }
  }

  return (
    <Dialog
      open
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      description={
        user
          ? 'Cambia el nombre, el correo o el rol. La contraseña no se muestra ni se cambia aquí.'
          : 'El usuario podrá ingresar con su correo y la contraseña inicial que le entregues.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={busy}>
            {busy ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form
        id="user-form"
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {failure ? (
          <Notice tone="error" title="No se pudo guardar">
            {failure}
          </Notice>
        ) : null}
        <TextInput
          label="Nombre completo"
          required
          value={values.fullName}
          error={errors.fullName}
          autoComplete="off"
          onChange={(event) => change('fullName', event.target.value)}
        />
        <TextInput
          label="Correo institucional"
          type="email"
          required
          value={values.email}
          error={errors.email}
          autoComplete="off"
          onChange={(event) => change('email', event.target.value)}
        />
        <Select
          label="Rol"
          required
          placeholder="Selecciona un rol"
          options={ROLE_OPTIONS}
          value={values.role}
          error={errors.role}
          onChange={(event) => change('role', event.target.value as UserFormValues['role'])}
        />
        {user ? null : (
          <TextInput
            label="Contraseña inicial"
            type="password"
            required
            value={values.password}
            error={errors.password}
            help="Entre 12 y 128 caracteres. No se vuelve a mostrar."
            autoComplete="new-password"
            onChange={(event) => change('password', event.target.value)}
          />
        )}
      </form>
    </Dialog>
  );
}

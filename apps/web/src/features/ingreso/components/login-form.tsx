'use client';

import { useState, type SyntheticEvent } from 'react';

import { SessionEndedNotice, useSession, type SignInField } from '@/shared/session';
import { Button, Checkbox, Notice, TextInput } from '@/shared/ui';

import { useHydrated } from '../hooks/use-hydrated';
import styles from './ingreso-screen.module.css';

export interface LoginFormProps {
  /** La sesión aún se está comprobando: el formulario no puede enviarse. */
  loading: boolean;
  /** La sesión anterior terminó (`motivo=sesion-vencida`): se avisa sobre el formulario. */
  sessionEnded: boolean;
}

/**
 * Formulario de ingreso. Conserva `method="post"` (sin él, un envío previo a la hidratación pondría
 * la contraseña en la URL) y mantiene «Ingresar» deshabilitado hasta hidratar. Al iniciar sesión no
 * navega: `/ingreso` decide el destino (aviso de datos, retorno o selección de vista).
 */
export function LoginForm({ loading, sessionEnded }: LoginFormProps) {
  const { signIn } = useSession();
  const hydrated = useHydrated();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignInField, string>>>({});

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const result = await signIn({ email: email.trim(), password, rememberMe });
    if (result.ok) {
      // Se mantiene «enviando» hasta que `/ingreso` cambie de vista y desmonte el formulario.
      return;
    }
    setSubmitting(false);
    setPassword('');
    setFieldErrors(result.fieldErrors);
    setError(result.error.message);
  }

  return (
    <>
      <h1 className={styles.title}>Te damos la bienvenida</h1>
      <p className={styles.subtitle}>Ingresa con tu cuenta institucional.</p>
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        className={styles.form}
        aria-busy={loading || undefined}
        noValidate
      >
        {sessionEnded ? <SessionEndedNotice /> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextInput
          label="Correo institucional"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          required
        />
        <TextInput
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          required
        />
        <Checkbox
          label="Mantener la sesión iniciada"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
        />
        <Button
          type="submit"
          className={styles.submit}
          disabled={!hydrated || loading || submitting}
          endIcon="flecha"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </>
  );
}

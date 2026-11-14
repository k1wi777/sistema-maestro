'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type SyntheticEvent } from 'react';

import {
  REASON_PARAM,
  RETURN_PARAM,
  SESSION_EXPIRED_REASON,
  SessionEndedNotice,
  safeReturnPath,
  useSession,
  type SignInField,
} from '@/shared/session';
import { Button, Checkbox, Notice, PageContainer, PageHeader, TextInput } from '@/shared/ui';

import styles from './ingreso-screen.module.css';

/** Ingreso mínimo y funcional; FE-11 lo rediseña con la pantalla definitiva. */
export function IngresoScreen() {
  const { state, signIn } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get(RETURN_PARAM);
  const sessionEnded = params.get(REASON_PARAM) === SESSION_EXPIRED_REASON;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignInField, string>>>({});

  // Quien ya tiene sesión no necesita esta pantalla: va a su vista propia (o a su retorno).
  useEffect(() => {
    if (state.status === 'authenticated') {
      router.replace(safeReturnPath(returnTo, state.user.role));
    }
  }, [state, returnTo, router]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const result = await signIn({ email: email.trim(), password, rememberMe });
    if (result.ok) {
      // Se mantiene «enviando» hasta que la navegación desmonte la pantalla.
      router.replace(safeReturnPath(returnTo, result.user.role));
      return;
    }
    setSubmitting(false);
    setPassword('');
    setFieldErrors(result.fieldErrors);
    setError(result.error.message);
  }

  if (state.status === 'authenticated') {
    return (
      <PageContainer>
        <p role="status" aria-busy="true">
          Cargando…
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        context="Ingreso"
        title="Bienvenida a la Plataforma GNS"
        description="Ingresa con tu cuenta institucional."
      />
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        className={styles.form}
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
        <div>
          <Button type="submit" disabled={submitting} endIcon="flecha">
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

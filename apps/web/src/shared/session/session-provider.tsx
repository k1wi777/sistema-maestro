'use client';

import { loginSchema } from '@gns/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, callApi, networkError, onSessionEvent, type ApiError } from '../api';
import { resolveSession } from './resolve-session';
import {
  applyResolution,
  endSession,
  requireConsent,
  type CurrentUser,
  type SessionState,
} from './session-state';

/** Una revalidación al volver a la pestaña como mucho cada 60 s. */
const REVALIDATE_MIN_INTERVAL_MS = 60_000;

export type SignInField = 'email' | 'password';

export type SignInResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: ApiError; fieldErrors: Partial<Record<SignInField, string>> };

export interface SessionContextValue {
  state: SessionState;
  /** Valida con `loginSchema`, inicia sesión y resuelve el aviso de datos. */
  signIn: (input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<SignInResult>;
  /** Cierra la sesión en la API (si falla, la descarta igual) y lleva a `/ingreso`. */
  signOut: () => Promise<void>;
  /** Vuelve a resolver la sesión con la API (rol y aviso vigentes). */
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function isSignInField(field: string): field is SignInField {
  return field === 'email' || field === 'password';
}

function fieldErrorsOf(errors: { field: string; reason: string }[] | undefined) {
  const result: Partial<Record<SignInField, string>> = {};
  for (const { field, reason } of errors ?? []) {
    if (isSignInField(field) && !result[field]) {
      result[field] = reason;
    }
  }
  return result;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const lastResolvedAt = useRef(0);

  const refreshSession = useCallback(async () => {
    lastResolvedAt.current = Date.now();
    const resolution = await resolveSession();
    // Las actualizaciones tras el primer estado son en segundo plano: no sacan al usuario de lo que hace.
    setState((previous) =>
      applyResolution(
        previous,
        resolution,
        previous.status !== 'loading' && previous.status !== 'unavailable',
      ),
    );
  }, []);

  // Resolución inicial.
  useEffect(() => {
    lastResolvedAt.current = Date.now();
    void resolveSession().then((resolution) => {
      setState((previous) => applyResolution(previous, resolution, false));
    });
  }, []);

  // Avisos del cliente HTTP: renovación fallida y aviso de datos exigido por la API.
  useEffect(() => {
    const offEnded = onSessionEvent('ended', () => setState(endSession));
    const offConsent = onSessionEvent('consent-required', () => setState(requireConsent));
    return () => {
      offEnded();
      offConsent();
    };
  }, []);

  // Revalidación al volver a la pestaña (rol cambiado, sesión revocada, aviso aceptado).
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastResolvedAt.current >= REVALIDATE_MIN_INTERVAL_MS
      ) {
        void refreshSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshSession]);

  const signIn = useCallback<SessionContextValue['signIn']>(async (input) => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<SignInField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (isSignInField(field) && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return {
        ok: false,
        fieldErrors,
        error: {
          statusCode: 400,
          code: 'validacion',
          message: 'Revisa los datos ingresados.',
          requestId: '',
        },
      };
    }
    const login = await callApi(() => api.POST('/auth/login', { body: parsed.data }));
    if (!login.ok) {
      const errors = 'errors' in login.error ? login.error.errors : undefined;
      return { ok: false, error: login.error, fieldErrors: fieldErrorsOf(errors) };
    }
    const resolution = await resolveSession();
    lastResolvedAt.current = Date.now();
    setState((previous) => applyResolution(previous, resolution, false));
    if (resolution.kind === 'authenticated') {
      return { ok: true, user: resolution.user };
    }
    return { ok: false, fieldErrors: {}, error: networkError() };
  }, []);

  const signOut = useCallback(async () => {
    await callApi(() => api.POST('/auth/logout'));
    setState({ status: 'anonymous', signedOut: true });
    router.replace('/ingreso');
  }, [router]);

  const value = useMemo(
    () => ({ state, signIn, signOut, refreshSession }),
    [state, signIn, signOut, refreshSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider.');
  }
  return context;
}

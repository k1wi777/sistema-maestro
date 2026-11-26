'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { CERTIFICATE_VERIFICATION_PATH, INSTITUTION, LegalLinks } from '@/shared/legal';
import {
  REASON_PARAM,
  RETURN_PARAM,
  SESSION_EXPIRED_REASON,
  homePathFor,
  safeReturnPath,
  useSession,
  type SessionState,
} from '@/shared/session';
import { VIEWS, firstSectionHref } from '@/shared/shell';

import { ingresoView } from '../ingreso-view';
import { ConsentDialog } from './consent-dialog';
import styles from './ingreso-screen.module.css';
import { LoginForm } from './login-form';

const RULES = {
  safeReturnPath,
  homePath: homePathFor,
  homeSection: (role: Parameters<typeof homePathFor>[0]) =>
    firstSectionHref(VIEWS[homePathFor(role)]),
};

/** Panel de marca del tablero: escudo, nombre, lema y texto institucional. */
function BrandPanel({ compact }: { compact: boolean }) {
  return (
    <section
      className={styles.brand}
      aria-label={compact ? undefined : INSTITUTION.displayName}
      aria-hidden={compact || undefined}
      inert={compact}
    >
      <div className={styles.brandInner}>
        <div className={styles.logo}>
          <Image
            src="/escudo-gns.webp"
            alt={compact ? '' : 'Escudo de George Noble School'}
            width={72}
            height={72}
            className={styles.seal}
            priority
          />
          <div>
            <span className={styles.logoName}>
              George Noble
              <br />
              School
            </span>
            <span className={styles.logoPlace}>Montería · Colombia</span>
          </div>
        </div>
        <p className={styles.motto}>
          Make it <span className={styles.mottoAccent}>possible</span>
        </p>
        {compact ? null : (
          <>
            <p className={styles.lead}>
              Plataforma institucional para planear, registrar y acompañar el trabajo pedagógico de
              nuestros docentes.
            </p>
            <ul className={styles.facts}>
              <li>Colegio bilingüe</li>
              <li>Calendario B</li>
              <li>Acreditado por Cognia</li>
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <p>© {INSTITUTION.displayName} · Montería</p>
      <LegalLinks />
      <p>
        <Link href={CERTIFICATE_VERIFICATION_PATH}>Verificar un certificado</Link>
      </p>
    </footer>
  );
}

function AccessCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.card}>
      {children}
      <Footer />
    </div>
  );
}

function view(state: SessionState, returnTo: string | null) {
  return ingresoView(state, returnTo, RULES);
}

/** Marco de la pantalla: panel de marca y acceso; con el aviso abierto, ambos quedan `inert`. */
function IngresoFrame({
  consent,
  overlay,
  children,
}: {
  consent: boolean;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.login}>
      <BrandPanel compact={consent} />
      <main className={styles.access} inert={consent} aria-hidden={consent || undefined}>
        {consent ? null : <AccessCard>{children}</AccessCard>}
      </main>
      {overlay}
    </div>
  );
}

/**
 * Lo que se sirve en el HTML antes de que haya parámetros de la URL ni sesión: el formulario con
 * «Ingresar» deshabilitado. Así, mientras la página no hidrata, no hay nada que enviar.
 */
export function IngresoFallback() {
  return (
    <IngresoFrame consent={false}>
      <LoginForm loading sessionEnded={false} />
    </IngresoFrame>
  );
}

/** Ingreso: formulario, aviso de datos o navegación a la vista del rol según la sesión (`ingresoView`). */
export function IngresoScreen() {
  const { state } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get(RETURN_PARAM);
  const sessionEnded = params.get(REASON_PARAM) === SESSION_EXPIRED_REASON;
  const current = view(state, returnTo);
  const target = current.kind === 'navigate' ? current.to : null;
  const consent = current.kind === 'consent';

  // Con sesión y el aviso vigente aceptado no hay nada que hacer aquí: se va a la vista.
  useEffect(() => {
    if (target) {
      router.replace(target);
    }
  }, [target, router]);

  return (
    <IngresoFrame consent={consent} overlay={consent ? <ConsentDialog /> : null}>
      {current.kind === 'form' ? (
        <LoginForm loading={current.busy} sessionEnded={sessionEnded} />
      ) : null}
      {current.kind === 'navigate' ? (
        <p role="status" aria-busy="true">
          Cargando…
        </p>
      ) : null}
    </IngresoFrame>
  );
}

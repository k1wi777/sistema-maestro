import type { ReactNode } from 'react';

import { BrandMark, ButtonLink } from '@/shared/ui';

import styles from './legal-shell.module.css';

/** Cabecera de las páginas legales públicas. «Volver» va a `/ingreso`, que resuelve a dónde según la sesión. */
export function LegalShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={styles.top}>
        <BrandMark tagline="Montería · Colombia" />
        <ButtonLink href="/ingreso" variant="outline" size="sm" startIcon="volver">
          Volver
        </ButtonLink>
      </div>
      {children}
    </>
  );
}

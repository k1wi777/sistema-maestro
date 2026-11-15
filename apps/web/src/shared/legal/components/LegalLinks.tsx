import Link from 'next/link';

import { PRIVACY_POLICY_PATH, TERMS_OF_USE_PATH } from '../routes';
import styles from './legal.module.css';

export interface LegalLinksProps {
  /** Abre los documentos en una pestaña nueva (aviso de datos: no se pierden las casillas). */
  newTab?: boolean;
  className?: string;
}

/** Enlaces a la Política de tratamiento de la información y a los Términos de uso. */
export function LegalLinks({ newTab, className }: LegalLinksProps) {
  const target = newTab ? '_blank' : undefined;
  const rel = newTab ? 'noopener' : undefined;
  return (
    <nav
      aria-label="Documentos legales"
      className={[styles.links, className].filter(Boolean).join(' ')}
    >
      <Link href={PRIVACY_POLICY_PATH} target={target} rel={rel}>
        Política de tratamiento de la información
      </Link>
      <Link href={TERMS_OF_USE_PATH} target={target} rel={rel}>
        Términos de uso
      </Link>
    </nav>
  );
}

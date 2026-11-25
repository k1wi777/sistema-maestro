'use client';

import { LegalLinks } from '@/shared/legal';
import { initialsOf, roleLabel, useSession, type CurrentUser } from '@/shared/session';
import { Icon, ThemeToggle } from '@/shared/ui';

import styles from './app-shell.module.css';

export interface AccountPanelProps {
  id: string;
  user: CurrentUser;
}

/**
 * Cuenta: un bloque translúcido con quién ingresó (cada rol tiene una sola vista), el selector de
 * tema y «Cerrar sesión», y debajo los enlaces legales. Un solo panel sirve a escritorio (fijo en
 * el menú) y a celular (desplegable bajo la barra superior): el CSS decide cómo se ve.
 */
export function AccountPanel({ id, user }: AccountPanelProps) {
  const { signOut } = useSession();

  return (
    <div id={id} className={styles.account}>
      <div className={styles.accountCard}>
        <div className={styles.who}>
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(user.fullName)}
          </span>
          <span className={styles.whoText}>
            <b>{user.fullName}</b>
            <span>{roleLabel(user.role)}</span>
          </span>
        </div>
        <hr className={styles.divider} />
        <div className={styles.theme}>
          <ThemeToggle appearance="onBrand" />
        </div>
        <button type="button" className={styles.action} onClick={() => void signOut()}>
          <Icon name="salir" size={16} />
          Cerrar sesión
        </button>
      </div>
      <LegalLinks className={styles.legal} />
    </div>
  );
}

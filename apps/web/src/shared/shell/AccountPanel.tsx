'use client';

import Link from 'next/link';

import { LegalLinks } from '@/shared/legal';
import {
  availableViews,
  initialsOf,
  roleLabel,
  useSession,
  type CurrentUser,
} from '@/shared/session';
import { Icon, ThemeToggle } from '@/shared/ui';

import styles from './app-shell.module.css';

export interface AccountPanelProps {
  id: string;
  user: CurrentUser;
}

/**
 * Cuenta: quién ingresó, «Cambiar de vista» (solo si el rol alcanza más de una), tema, «Cerrar
 * sesión» y enlaces legales. Un solo panel sirve a escritorio (fijo en el menú) y a celular
 * (desplegable bajo la barra superior): el CSS decide cómo se ve.
 */
export function AccountPanel({ id, user }: AccountPanelProps) {
  const { signOut } = useSession();
  const canSwitchView = availableViews(user.role).length > 1;

  return (
    <div id={id} className={styles.account}>
      <div className={styles.who}>
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(user.fullName)}
        </span>
        <span className={styles.whoText}>
          <b>{user.fullName}</b>
          <span>{roleLabel(user.role)}</span>
        </span>
      </div>
      <div className={styles.actions}>
        {canSwitchView ? (
          <Link href="/ingreso" className={styles.action}>
            <Icon name="volver" size={16} />
            Cambiar de vista
          </Link>
        ) : null}
        <button type="button" className={styles.action} onClick={() => void signOut()}>
          <Icon name="salir" size={16} />
          Cerrar sesión
        </button>
      </div>
      <div className={styles.theme}>
        <ThemeToggle />
      </div>
      <LegalLinks className={styles.legal} />
    </div>
  );
}

'use client';

import Link from 'next/link';

import { VIEWS } from '@/shared/shell';
import { availableViews, initialsOf, useSession, type CurrentUser } from '@/shared/session';
import { Button, Icon } from '@/shared/ui';

import styles from './ingreso-screen.module.css';

/** Selección de vista: quién ingresó, «Cerrar sesión» y una tarjeta por vista que su rol alcanza. */
export function ViewChooser({ user }: { user: CurrentUser }) {
  const { signOut } = useSession();
  const views = availableViews(user.role).map((path) => VIEWS[path]);

  return (
    <>
      <h1 className={styles.title}>Te damos la bienvenida</h1>
      <p className={styles.subtitle}>Elige cómo quieres entrar hoy.</p>
      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(user.fullName)}
        </span>
        <span className={styles.accountText}>
          <small>Sesión iniciada como</small>
          <b>{user.fullName}</b>
        </span>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
      <nav aria-label="Vistas disponibles" className={styles.views}>
        {views.map((view) => (
          <Link
            key={view.path}
            href={view.path}
            className={`${styles.view} ${view.path === '/coordinacion' ? styles.viewCoordination : ''}`}
          >
            <span className={styles.viewIcon}>
              <Icon name={view.icon} size={22} fill="tone" />
            </span>
            <span className={styles.viewText}>
              <span className={styles.viewName}>{view.title}</span>
              <span className={styles.viewDescription}>{view.description}</span>
            </span>
            <Icon name="flecha" size={20} className={styles.viewArrow} />
          </Link>
        ))}
      </nav>
      <p className={styles.note}>
        Ingresas con tu cuenta institucional. La administración de la plataforma crea los usuarios y
        asigna sus roles.
      </p>
    </>
  );
}

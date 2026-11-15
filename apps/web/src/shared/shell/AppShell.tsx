'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { initialsOf, useSession, type ProtectedRoute } from '@/shared/session';
import { Icon } from '@/shared/ui';

import { AccountPanel } from './AccountPanel';
import styles from './app-shell.module.css';
import { VIEWS, isActiveSection } from './navigation';

export interface AppShellProps {
  view: ProtectedRoute;
  children: ReactNode;
}

/**
 * Marco de las vistas docente y coordinación: menú lateral en escritorio y barra superior con
 * panel de cuenta desplegable en celular (≤ 860 px). Se monta dentro de `RequireRole`.
 */
export function AppShell({ view, children }: AppShellProps) {
  const { state } = useSession();
  const pathname = usePathname();
  const panelId = useId();
  const accountRef = useRef<HTMLDivElement>(null);
  // El panel recuerda en qué ruta se abrió: al navegar deja de estar abierto sin efectos extra.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpenAt(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (state.status !== 'authenticated') {
    return null;
  }
  const config = VIEWS[view];

  return (
    <div className={styles.shell}>
      <aside className={styles.aside}>
        <div className={styles.bar} ref={accountRef}>
          <div className={styles.brand}>
            <Image src="/escudo-gns.webp" alt="" width={40} height={40} className={styles.seal} />
            <div className={styles.brandText}>
              <b>{config.title}</b>
              <small>George Noble School · Montería</small>
            </div>
          </div>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label="Cuenta y opciones"
            onClick={() => setOpenAt(open ? null : pathname)}
          >
            <span aria-hidden="true">{initialsOf(state.user.fullName)}</span>
            <Icon name={open ? 'arriba' : 'abajo'} size={16} />
          </button>
          <div className={styles.panel} data-open={open}>
            <AccountPanel id={panelId} user={state.user} />
          </div>
        </div>
        <nav aria-label={config.title} className={styles.menu}>
          {config.groups.map((group, index) => (
            <div key={group.title ?? index} className={styles.group}>
              {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
              {group.sections.map((section) => {
                const content = (
                  <>
                    <Icon name={section.icon} size={18} />
                    <span>{section.label}</span>
                    {section.soon ? <span className={styles.soon}>pronto</span> : null}
                  </>
                );
                if (!section.href) {
                  return (
                    <span key={section.label} className={styles.item} aria-disabled="true">
                      {content}
                    </span>
                  );
                }
                const current = isActiveSection(pathname, section.href);
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={styles.item}
                    aria-current={current ? 'page' : undefined}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

'use client';

import type { UserRole } from '@gns/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { PageContainer } from '@/shared/ui';

import { loginPath } from '../return-path';
import { decideAccess, homePathFor } from '../route-access';
import { useSession } from '../session-provider';
import { AccessDeniedNotice } from './AccessDeniedNotice';
import { ConsentPendingNotice } from './ConsentPendingNotice';
import { SessionBar } from './SessionBar';
import { SessionUnavailableNotice } from './SessionUnavailableNotice';

export interface RequireRoleProps {
  /** Rol mínimo de la ruta. */
  role: UserRole;
  children: ReactNode;
}

/**
 * Frontera de las rutas protegidas. Es una capa de experiencia: la autorización real la
 * hace la API; aquí solo se decide qué pintar según la sesión.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { state, signOut, refreshSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const decision = decideAccess(state, role);

  useEffect(() => {
    if (decision === 'redirect-login') {
      router.replace(loginPath(state, pathname));
    }
  }, [decision, state, pathname, router]);

  switch (decision) {
    case 'allowed':
      return state.status === 'authenticated' ? (
        <>
          <SessionBar user={state.user} onSignOut={() => void signOut()} />
          {children}
        </>
      ) : null;
    case 'forbidden':
      return state.status === 'authenticated' ? (
        <AccessDeniedNotice homePath={homePathFor(state.user.role)} />
      ) : null;
    case 'consent-pending':
      return <ConsentPendingNotice onSignOut={() => void signOut()} />;
    case 'unavailable':
      return <SessionUnavailableNotice onRetry={() => void refreshSession()} />;
    case 'loading':
    case 'redirect-login':
      return (
        <PageContainer>
          <p role="status" aria-busy="true">
            Cargando…
          </p>
        </PageContainer>
      );
  }
}

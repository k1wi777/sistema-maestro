'use client';

import type { UserRole } from '@gns/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { PageContainer } from '@/shared/ui';

import { consentPath, loginPath } from '../return-path';
import { decideAccess, homePathFor } from '../route-access';
import { useSession } from '../session-provider';
import { AccessDeniedNotice } from './AccessDeniedNotice';
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
  const { state, refreshSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const decision = decideAccess(state, role);

  useEffect(() => {
    if (decision === 'redirect-login') {
      router.replace(loginPath(state, pathname));
    } else if (decision === 'consent-pending') {
      // El aviso vive en `/ingreso`: ninguna sección se pinta sin aceptarlo.
      router.replace(consentPath(pathname));
    }
  }, [decision, state, pathname, router]);

  switch (decision) {
    case 'allowed':
      return state.status === 'authenticated' ? <>{children}</> : null;
    case 'forbidden':
      return state.status === 'authenticated' ? (
        <AccessDeniedNotice homePath={homePathFor(state.user.role)} />
      ) : null;
    case 'unavailable':
      return <SessionUnavailableNotice onRetry={() => void refreshSession()} />;
    case 'loading':
    case 'redirect-login':
    case 'consent-pending':
      return (
        <PageContainer>
          <p role="status" aria-busy="true">
            Cargando…
          </p>
        </PageContainer>
      );
  }
}

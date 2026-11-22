'use client';

import type { UserRole } from '@gns/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { PageContainer } from '@/shared/ui';

import { equivalentPath } from '../equivalent-path';
import { consentPath, loginPath } from '../return-path';
import { decideAccess, homePathFor } from '../route-access';
import { useSession } from '../session-provider';
import { AccessDeniedNotice } from './AccessDeniedNotice';
import { SessionUnavailableNotice } from './SessionUnavailableNotice';

export interface RequireRoleProps {
  /** Roles que admite la vista (sin jerarquía). */
  roles: readonly UserRole[];
  children: ReactNode;
}

/**
 * Frontera de las rutas protegidas. Es una capa de experiencia: la autorización real la
 * hace la API; aquí solo se decide qué pintar según la sesión.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { state, refreshSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const decision = decideAccess(state, roles);
  // Quien abre una ruta de otra vista de personal va a la equivalente de la suya, si existe.
  const equivalent =
    state.status === 'authenticated' && decision === 'forbidden'
      ? equivalentPath(pathname, state.user.role)
      : null;

  useEffect(() => {
    if (decision === 'redirect-login') {
      router.replace(loginPath(state, pathname));
    } else if (decision === 'consent-pending') {
      // El aviso vive en `/ingreso`: ninguna sección se pinta sin aceptarlo.
      router.replace(consentPath(pathname));
    } else if (equivalent) {
      router.replace(`${equivalent}${window.location.search}`);
    }
  }, [decision, state, pathname, equivalent, router]);

  switch (decision) {
    case 'allowed':
      return state.status === 'authenticated' ? <>{children}</> : null;
    case 'forbidden':
      if (equivalent) {
        return <LoadingNotice />;
      }
      return state.status === 'authenticated' ? (
        <AccessDeniedNotice homePath={homePathFor(state.user.role)} />
      ) : null;
    case 'unavailable':
      return <SessionUnavailableNotice onRetry={() => void refreshSession()} />;
    case 'loading':
    case 'redirect-login':
    case 'consent-pending':
      return <LoadingNotice />;
  }
}

function LoadingNotice() {
  return (
    <PageContainer>
      <p role="status" aria-busy="true">
        Cargando…
      </p>
    </PageContainer>
  );
}

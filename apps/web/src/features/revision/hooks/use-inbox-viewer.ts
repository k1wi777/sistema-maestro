'use client';

import { UserRole } from '@gns/shared';

import { useSession } from '@/shared/session';
import type { ReviewUser } from '@/shared/records';

export interface InboxViewer {
  user: ReviewUser | null;
  isCoordinator: boolean;
  isAdministrator: boolean;
}

/** Quién consulta las bandejas y el hub de Formatos: coordinación o administración. */
export function useInboxViewer(): InboxViewer {
  const { state } = useSession();
  const user = state.status === 'authenticated' ? state.user : null;
  return {
    user: user ? { id: user.id, role: user.role } : null,
    isCoordinator: user?.role === UserRole.Coordinator,
    isAdministrator: user?.role === UserRole.Administrator,
  };
}

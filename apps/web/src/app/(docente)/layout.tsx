import { UserRole } from '@gns/shared';
import type { ReactNode } from 'react';

import { RequireRole } from '@/shared/session';

// Sin menú todavía: los menús de cada rol llegan con la navegación (FE-13).
export default function DocenteLayout({ children }: { children: ReactNode }) {
  return <RequireRole role={UserRole.Teacher}>{children}</RequireRole>;
}

import { UserRole } from '@gns/shared';
import type { ReactNode } from 'react';

import { RequireRole } from '@/shared/session';
import { AppShell } from '@/shared/shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role={UserRole.Coordinator}>
      <AppShell view="/coordinacion">{children}</AppShell>
    </RequireRole>
  );
}

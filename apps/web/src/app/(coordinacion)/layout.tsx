import type { ReactNode } from 'react';

import { PROTECTED_ROUTES, RequireRole } from '@/shared/session';
import { AppShell } from '@/shared/shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={PROTECTED_ROUTES['/coordinacion']}>
      <AppShell view="/coordinacion">{children}</AppShell>
    </RequireRole>
  );
}

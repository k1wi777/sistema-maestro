import { UserRole } from '@gns/shared';
import type { ReactNode } from 'react';

import { AssistantLauncher } from '@/features/asistente';
import { RequireRole } from '@/shared/session';
import { AppShell } from '@/shared/shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role={UserRole.Teacher}>
      <AppShell view="/docente">
        {children}
        {/* El botón «¿Dudas?» está en todas las pantallas docentes (menos en la del asistente). */}
        <AssistantLauncher />
      </AppShell>
    </RequireRole>
  );
}

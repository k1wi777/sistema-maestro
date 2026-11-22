import type { ReactNode } from 'react';

import { AssistantLauncher } from '@/features/asistente';
import { PROTECTED_ROUTES, RequireRole } from '@/shared/session';
import { AppShell } from '@/shared/shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={PROTECTED_ROUTES['/docente']}>
      <AppShell view="/docente">
        {children}
        {/* El botón «¿Dudas?» está en todas las pantallas docentes (menos en la del asistente). */}
        <AssistantLauncher />
      </AppShell>
    </RequireRole>
  );
}

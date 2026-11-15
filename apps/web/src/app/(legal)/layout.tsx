import type { ReactNode } from 'react';

import { LegalShell } from '@/features/legal';

// Páginas públicas: se ven sin sesión y no pasan por RequireRole.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalShell>{children}</LegalShell>;
}

import type { ReactNode } from 'react';

// Sin menú todavía: los menús de cada rol llegan con la navegación (FE-13).
export default function CoordinacionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

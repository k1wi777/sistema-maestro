import type { Metadata } from 'next';

import { DocenteScreen } from '@/features/docente';

export const metadata: Metadata = { title: 'Vista docente' };

export default function DocentePage() {
  return <DocenteScreen />;
}

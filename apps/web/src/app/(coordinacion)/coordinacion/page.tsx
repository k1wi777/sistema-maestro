import type { Metadata } from 'next';

import { CoordinacionScreen } from '@/features/coordinacion';

export const metadata: Metadata = { title: 'Coordinación académica' };

export default function CoordinacionPage() {
  return <CoordinacionScreen />;
}

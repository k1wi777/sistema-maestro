import type { Metadata } from 'next';

import { IngresoScreen } from '@/features/ingreso';

export const metadata: Metadata = { title: 'Ingreso' };

export default function IngresoPage() {
  return <IngresoScreen />;
}

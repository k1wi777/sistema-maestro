import type { Metadata } from 'next';
import { Suspense } from 'react';

import { IngresoScreen } from '@/features/ingreso';

export const metadata: Metadata = { title: 'Ingreso' };

export default function IngresoPage() {
  // useSearchParams (ruta de retorno y motivo) exige Suspense para poder prerenderizar.
  return (
    <Suspense>
      <IngresoScreen />
    </Suspense>
  );
}

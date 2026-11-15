import type { Metadata } from 'next';
import { Suspense } from 'react';

import { IngresoFallback, IngresoScreen } from '@/features/ingreso';

export const metadata: Metadata = { title: 'Ingreso' };

export default function IngresoPage() {
  // useSearchParams (ruta de retorno y motivo) exige Suspense para poder prerenderizar; el respaldo
  // lleva el formulario con «Ingresar» deshabilitado, que es lo que se sirve antes de hidratar.
  return (
    <Suspense fallback={<IngresoFallback />}>
      <IngresoScreen />
    </Suspense>
  );
}

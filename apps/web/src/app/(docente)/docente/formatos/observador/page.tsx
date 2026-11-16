import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ObserverListScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Observador del estudiante' };

export default function Page() {
  // useSearchParams (filtro por estado) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <ObserverListScreen />
    </Suspense>
  );
}

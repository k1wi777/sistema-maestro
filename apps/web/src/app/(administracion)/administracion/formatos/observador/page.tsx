import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ObserverInboxScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Observadores' };

export default function Page() {
  // useSearchParams (filtro por estado) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <ObserverInboxScreen />
    </Suspense>
  );
}

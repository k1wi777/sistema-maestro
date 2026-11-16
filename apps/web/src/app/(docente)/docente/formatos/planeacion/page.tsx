import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlanningScreen } from '@/features/planeacion';

export const metadata: Metadata = { title: 'Planeación GNS' };

export default function Page() {
  // useSearchParams (pestaña y filtros) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <PlanningScreen />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlanInboxScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Planeaciones' };

export default function Page() {
  // useSearchParams (filtros) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <PlanInboxScreen />
    </Suspense>
  );
}

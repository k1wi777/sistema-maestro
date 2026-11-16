import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlanInboxScreen } from '@/features/revision';
import { sectionByHref } from '@/shared/shell';

const HREF = '/coordinacion/planeaciones';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (filtros) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <PlanInboxScreen />
    </Suspense>
  );
}

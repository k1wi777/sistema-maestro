import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlanningScreen } from '@/features/planeacion';
import { sectionByHref } from '@/shared/shell';

const HREF = '/docente/planeacion';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (pestaña y filtros) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <PlanningScreen />
    </Suspense>
  );
}

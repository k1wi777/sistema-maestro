import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TrackingScreen } from '@/features/gestion-formacion';
import { sectionByHref } from '@/shared/shell';

const HREF = '/administracion/avance';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (plan y módulo en la URL) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <TrackingScreen />
    </Suspense>
  );
}

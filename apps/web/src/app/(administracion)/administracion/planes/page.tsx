import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlansScreen } from '@/features/gestion-formacion';
import { sectionByHref } from '@/shared/shell';

const HREF = '/administracion/planes';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (plan elegido en la URL) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <PlansScreen />
    </Suspense>
  );
}

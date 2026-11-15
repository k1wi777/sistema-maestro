import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FormatsScreen } from '@/features/formatos';
import { sectionByHref } from '@/shared/shell';

const HREF = '/docente/formatos';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (pestaña y filtro) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <FormatsScreen />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FormatsInboxScreen } from '@/features/revision';
import { sectionByHref } from '@/shared/shell';

const HREF = '/coordinacion/formatos';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (pestaña y filtro) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <FormatsInboxScreen />
    </Suspense>
  );
}

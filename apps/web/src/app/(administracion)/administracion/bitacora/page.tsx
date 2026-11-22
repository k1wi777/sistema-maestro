import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuditLogScreen } from '@/features/bitacora';
import { sectionByHref } from '@/shared/shell';

const HREF = '/administracion/bitacora';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  // useSearchParams (filtros) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <AuditLogScreen />
    </Suspense>
  );
}

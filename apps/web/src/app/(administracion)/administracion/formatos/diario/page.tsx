import type { Metadata } from 'next';
import { Suspense } from 'react';

import { JournalInboxScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Diarios de campo' };

export default function Page() {
  // useSearchParams (filtro por estado) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <JournalInboxScreen />
    </Suspense>
  );
}

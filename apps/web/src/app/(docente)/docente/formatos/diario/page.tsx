import type { Metadata } from 'next';
import { Suspense } from 'react';

import { JournalListScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Diario de campo' };

export default function Page() {
  // useSearchParams (filtro por estado) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <JournalListScreen />
    </Suspense>
  );
}

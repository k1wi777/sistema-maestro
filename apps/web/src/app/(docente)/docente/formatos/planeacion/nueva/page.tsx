import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NewLessonPlanScreen } from '@/features/planeacion';

export const metadata: Metadata = { title: 'Nueva planeación' };

export default function Page() {
  // useSearchParams (actividad de partida) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <NewLessonPlanScreen />
    </Suspense>
  );
}

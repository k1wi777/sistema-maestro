import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PlanReviewScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Revisión de planeación' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // useSearchParams (filtros de la bandeja a la que se vuelve) exige Suspense para prerenderizar.
  return (
    <Suspense>
      <PlanReviewScreen id={id} />
    </Suspense>
  );
}

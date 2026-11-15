import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LessonPlanEditorScreen } from '@/features/planeacion';

export const metadata: Metadata = { title: 'Planeación' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // useSearchParams (paso y vista) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <LessonPlanEditorScreen id={id} />
    </Suspense>
  );
}

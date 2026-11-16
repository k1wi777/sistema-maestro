import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ModuleEditorScreen } from '@/features/gestion-formacion';

export const metadata: Metadata = { title: 'Editor de módulo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // useSearchParams (paso del editor) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <ModuleEditorScreen id={id} />
    </Suspense>
  );
}

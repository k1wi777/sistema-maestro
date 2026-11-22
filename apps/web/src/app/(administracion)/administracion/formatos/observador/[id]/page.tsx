import type { Metadata } from 'next';

import { ObserverReviewScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Revisión de anotación del observador' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ObserverReviewScreen id={id} />;
}

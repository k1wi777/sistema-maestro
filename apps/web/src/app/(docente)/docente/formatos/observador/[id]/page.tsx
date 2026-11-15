import type { Metadata } from 'next';

import { ObserverNoteScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Anotación del observador' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ObserverNoteScreen id={id} />;
}

import type { Metadata } from 'next';

import { FieldJournalScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Diario de campo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FieldJournalScreen id={id} />;
}

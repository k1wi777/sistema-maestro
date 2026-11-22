import type { Metadata } from 'next';

import { JournalReviewScreen } from '@/features/revision';

export const metadata: Metadata = { title: 'Revisión de diario de campo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalReviewScreen id={id} />;
}

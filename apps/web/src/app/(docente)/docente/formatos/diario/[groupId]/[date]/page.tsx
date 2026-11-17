import type { Metadata } from 'next';

import { JournalDayScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Diario de campo' };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; date: string }>;
}) {
  const { groupId, date } = await params;
  return <JournalDayScreen groupId={groupId} date={date} />;
}

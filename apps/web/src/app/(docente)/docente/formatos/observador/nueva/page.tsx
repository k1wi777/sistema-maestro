import type { Metadata } from 'next';

import { NewObserverNoteScreen } from '@/features/formatos';

export const metadata: Metadata = { title: 'Nueva anotación' };

export default function Page() {
  return <NewObserverNoteScreen />;
}

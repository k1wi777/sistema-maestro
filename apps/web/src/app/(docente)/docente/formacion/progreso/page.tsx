import type { Metadata } from 'next';

import { TrainingProgressScreen } from '@/features/formacion';

export const metadata: Metadata = { title: 'Mi progreso y certificados' };

export default function Page() {
  return <TrainingProgressScreen />;
}

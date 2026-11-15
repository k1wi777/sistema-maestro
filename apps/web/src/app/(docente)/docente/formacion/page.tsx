import type { Metadata } from 'next';

import { TrainingRouteScreen } from '@/features/formacion';
import { sectionByHref } from '@/shared/shell';

const HREF = '/docente/formacion';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <TrainingRouteScreen />;
}

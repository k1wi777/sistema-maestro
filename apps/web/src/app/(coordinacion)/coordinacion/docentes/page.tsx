import type { Metadata } from 'next';

import { TeachersScreen } from '@/features/docentes';
import { sectionByHref } from '@/shared/shell';

const HREF = '/coordinacion/docentes';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <TeachersScreen />;
}

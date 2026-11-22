import type { Metadata } from 'next';

import { AcademicStructureScreen } from '@/features/grados-areas';
import { sectionByHref } from '@/shared/shell';

const HREF = '/administracion/grados-y-areas';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <AcademicStructureScreen />;
}

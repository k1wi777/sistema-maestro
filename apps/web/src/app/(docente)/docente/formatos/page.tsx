import type { Metadata } from 'next';

import { FormatsHubScreen } from '@/features/formatos';
import { sectionByHref } from '@/shared/shell';

const HREF = '/docente/formatos';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <FormatsHubScreen />;
}

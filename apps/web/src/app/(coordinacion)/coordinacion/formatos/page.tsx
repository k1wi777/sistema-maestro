import type { Metadata } from 'next';

import { ReviewFormatsHubScreen } from '@/features/revision';
import { sectionByHref } from '@/shared/shell';

const HREF = '/coordinacion/formatos';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <ReviewFormatsHubScreen />;
}

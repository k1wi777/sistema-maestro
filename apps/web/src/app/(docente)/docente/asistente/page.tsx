import type { Metadata } from 'next';

import { AssistantScreen } from '@/features/asistente';
import { sectionByHref } from '@/shared/shell';

const HREF = '/docente/asistente';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <AssistantScreen />;
}

import type { Metadata } from 'next';

import { FaqAdminScreen } from '@/features/asistente';
import { sectionByHref } from '@/shared/shell';

const HREF = '/administracion/asistente';

export const metadata: Metadata = { title: sectionByHref(HREF).section.label };

export default function Page() {
  return <FaqAdminScreen />;
}

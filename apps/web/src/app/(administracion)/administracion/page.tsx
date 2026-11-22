import { redirect } from 'next/navigation';

import { VIEWS, firstSectionHref } from '@/shared/shell';

export default function Page() {
  redirect(firstSectionHref(VIEWS['/administracion']));
}

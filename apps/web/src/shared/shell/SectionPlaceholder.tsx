import { Notice, PageContainer, PageHeader } from '@/shared/ui';

import { sectionByHref } from './navigation';

/** Página de marcador de una sección del menú hasta que se construya (FE-2 y FE-3). */
export function SectionPlaceholder({ href }: { href: string }) {
  const { view, section } = sectionByHref(href);
  return (
    <PageContainer>
      <PageHeader context={view.title} title={section.label} description={section.description} />
      <Notice tone="info" title="Próximamente">
        Esta sección estará disponible próximamente.
      </Notice>
    </PageContainer>
  );
}

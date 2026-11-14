import { Fragment } from 'react';

import { ButtonLink, Notice, PageContainer, PageHeader } from '@/shared/ui';

export interface AccessDeniedNoticeProps {
  /** Vista propia del usuario, a la que lleva el enlace. */
  homePath: string;
  /** Dentro de otra página (la muestra): sin `<main>` ni título de página. */
  embedded?: boolean;
}

/** Se muestra en lugar del contenido de una ruta que el rol del usuario no alcanza. */
export function AccessDeniedNotice({ homePath, embedded }: AccessDeniedNoticeProps) {
  const Wrapper = embedded ? Fragment : PageContainer;
  return (
    <Wrapper>
      {embedded ? null : (
        <PageHeader context="Acceso" title="Esta sección no está disponible para tu rol" />
      )}
      <Notice tone="warning" title="No tienes acceso a esta sección">
        Tu rol no permite abrir esta página. Si crees que es un error, escribe a coordinación
        académica.
      </Notice>
      <p>
        <ButtonLink href={homePath} variant="secondary" startIcon="volver">
          Ir a mi vista
        </ButtonLink>
      </p>
    </Wrapper>
  );
}

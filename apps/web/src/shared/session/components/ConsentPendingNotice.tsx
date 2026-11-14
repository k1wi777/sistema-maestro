import { Fragment } from 'react';

import { Button, Notice, PageContainer, PageHeader } from '@/shared/ui';

export interface ConsentPendingNoticeProps {
  onSignOut: () => void;
  /** Dentro de otra página (la muestra): sin `<main>` ni título de página. */
  embedded?: boolean;
}

/**
 * Aviso de datos sin aceptar. No hay formulario: la aceptación llega con FE-12, que sustituirá
 * este componente.
 */
export function ConsentPendingNotice({ onSignOut, embedded }: ConsentPendingNoticeProps) {
  const Wrapper = embedded ? Fragment : PageContainer;
  return (
    <Wrapper>
      {embedded ? null : (
        <PageHeader context="Tratamiento de datos" title="Falta aceptar el aviso de datos" />
      )}
      <Notice tone="info" title="Aceptación pendiente">
        Para usar la plataforma debes aceptar el aviso de tratamiento de datos personales (Ley 1581
        de 2012). La pantalla para aceptarlo estará disponible muy pronto.
      </Notice>
      <p>
        <Button variant="outline" startIcon="salir" onClick={onSignOut}>
          Cerrar sesión
        </Button>
      </p>
    </Wrapper>
  );
}

import { Button, Notice, PageContainer, PageHeader } from '@/shared/ui';

export interface SessionUnavailableNoticeProps {
  onRetry: () => void;
}

/** La API no respondió al resolver la sesión: no se trata como sesión cerrada. */
export function SessionUnavailableNotice({ onRetry }: SessionUnavailableNoticeProps) {
  return (
    <PageContainer>
      <PageHeader context="Conexión" title="No pudimos comprobar tu sesión" />
      <Notice tone="error">
        No pudimos conectar con la plataforma. Revisa tu conexión e inténtalo de nuevo.
      </Notice>
      <p>
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      </p>
    </PageContainer>
  );
}

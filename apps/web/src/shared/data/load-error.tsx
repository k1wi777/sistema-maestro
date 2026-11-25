import type { ApiError } from '@/shared/api';
import { Button, Notice } from '@/shared/ui';

import styles from './load-error.module.css';

/** Aviso de error al cargar datos, con el motivo de la API y un botón para reintentar. */
export function LoadError({
  error,
  title = 'No pudimos cargar la información',
  onRetry,
}: {
  error: ApiError;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <Notice tone="error" title={title}>
      <p className={styles.text}>{error.message}</p>
      {onRetry ? (
        <p className={styles.retry}>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </p>
      ) : null}
    </Notice>
  );
}

/** Aviso de carga que lectores de pantalla anuncian al aparecer. */
export function Loading({ children }: { children: string }) {
  return (
    <p role="status" aria-busy="true" className={styles.loading}>
      {children}
    </p>
  );
}

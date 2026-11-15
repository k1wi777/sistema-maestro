'use client';

import { Button, Notice } from '@/shared/ui';

import type { CertificateDownload } from '../hooks/use-certificate-download';

/** Botón «Descargar» de un certificado; muestra «Preparando…» mientras se genera el PDF. */
export function CertificateDownloadButton({
  id,
  downloader,
  label = 'Descargar',
  ariaLabel,
}: {
  id: string;
  downloader: CertificateDownload;
  label?: string;
  ariaLabel?: string;
}) {
  const busy = downloader.busyId === id;
  return (
    <Button
      variant="outline"
      size="sm"
      startIcon="bajar"
      disabled={downloader.busyId !== null}
      aria-label={ariaLabel}
      aria-busy={busy}
      onClick={() => void downloader.download(id)}
    >
      {busy ? 'Preparando…' : label}
    </Button>
  );
}

/** Aviso del último fallo de descarga, con la opción de reintentar. */
export function CertificateDownloadError({ downloader }: { downloader: CertificateDownload }) {
  const { failure } = downloader;
  if (!failure) {
    return null;
  }
  return (
    <Notice tone="error" title="No pudimos descargar el certificado">
      <p>{failure.error.message}</p>
      <p>
        <Button
          variant="outline"
          size="sm"
          disabled={downloader.busyId !== null}
          onClick={() => void downloader.download(failure.id)}
        >
          Reintentar
        </Button>
      </p>
    </Notice>
  );
}

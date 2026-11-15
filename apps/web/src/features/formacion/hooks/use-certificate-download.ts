'use client';

import { useCallback, useState } from 'react';

import type { ApiError } from '@/shared/api';

import { downloadCertificate } from '../api/certificates';

export interface DownloadFailure {
  id: string;
  error: ApiError;
}

/**
 * Descarga de certificados. La API devuelve una URL firmada de descarga (`attachment`) y se navega
 * a ella con `location.assign`: es una descarga, la página no se va y no la frena el bloqueador de
 * ventanas. `busyId` marca el certificado en preparación (la primera vez genera el PDF) y `failure`
 * guarda el último fallo para ofrecer «Reintentar».
 */
export function useCertificateDownload() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<DownloadFailure | null>(null);

  const download = useCallback(async (id: string) => {
    setBusyId(id);
    setFailure(null);
    const result = await downloadCertificate(id);
    setBusyId(null);
    if (result.ok) {
      window.location.assign(result.data.url);
    } else {
      setFailure({ id, error: result.error });
    }
  }, []);

  return { busyId, failure, download };
}

export type CertificateDownload = ReturnType<typeof useCertificateDownload>;

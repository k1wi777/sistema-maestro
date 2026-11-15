'use client';

import Link from 'next/link';

import { LoadError, Loading } from '@/shared/data';
import { Notice } from '@/shared/ui';

import { useCertificateDownload } from '../hooks/use-certificate-download';
import { useMyCertificates } from '../hooks/use-training-module';
import { CertificateDownloadButton, CertificateDownloadError } from './certificate-download-button';
import { PROGRESS_HREF } from './training-header';
import styles from './module-done-notice.module.css';

/**
 * Aviso de módulo terminado con la descarga de su certificado. Pide los certificados solo cuando se
 * monta, es decir, cuando la API ya dio el módulo por terminado (el certificado se emite en la
 * misma transacción).
 */
export function ModuleDoneNotice({ moduleId }: { moduleId: string }) {
  const { state, reload } = useMyCertificates();
  const downloader = useCertificateDownload();

  let action;
  if (state.status === 'loading') {
    action = <Loading>Preparando tu certificado…</Loading>;
  } else if (state.status === 'error') {
    action = (
      <LoadError error={state.error} title="No pudimos cargar tu certificado" onRetry={reload} />
    );
  } else {
    const certificate = state.data.find((item) => item.moduleId === moduleId);
    action = certificate ? (
      <CertificateDownloadButton
        id={certificate.id}
        downloader={downloader}
        label="Descargar certificado"
      />
    ) : (
      <p>
        Tu certificado estará en <Link href={PROGRESS_HREF}>Mi progreso y certificados</Link>.
      </p>
    );
  }

  return (
    <div className={styles.box}>
      <Notice tone="success" title="¡Terminaste este módulo!">
        Ya cumpliste todo lo que pedía. Descarga tu certificado cuando quieras.
      </Notice>
      <div className={styles.action}>{action}</div>
      <CertificateDownloadError downloader={downloader} />
    </div>
  );
}

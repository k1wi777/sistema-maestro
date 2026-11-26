'use client';

import { CertificateKind, type CertificateSummary } from '@gns/shared';
import Link from 'next/link';

import { formatDateTime } from '@/shared/format/dates';
import { CERTIFICATE_VERIFICATION_PATH } from '@/shared/legal';
import { Card } from '@/shared/ui';

import type { CertificateDownload } from '../hooks/use-certificate-download';
import { CERTIFICATE_KIND_LABEL } from '../model/labels';
import type { RouteCertificate } from '../model/progress';
import { CertificateDownloadButton } from './certificate-download-button';
import styles from './certificates-panel.module.css';

export const VERIFY_HREF = CERTIFICATE_VERIFICATION_PATH;

export const verifyHref = (code: string): string =>
  `${VERIFY_HREF}?codigo=${encodeURIComponent(code)}`;

function CertificateItem({
  certificate,
  downloader,
}: {
  certificate: CertificateSummary;
  downloader: CertificateDownload;
}) {
  return (
    <li className={styles.item}>
      <div className={styles.info}>
        <p className={styles.kind}>{CERTIFICATE_KIND_LABEL[certificate.kind]}</p>
        <p className={styles.title}>{certificate.title}</p>
        <p className={styles.meta}>
          {certificate.planName ? `${certificate.planName} · ` : ''}
          {`Emitido el ${formatDateTime(certificate.issuedAt)}`}
        </p>
        <p className={styles.meta}>
          Código de verificación: <code className={styles.code}>{certificate.code}</code>{' '}
          <Link href={verifyHref(certificate.code)}>Verificar</Link>
        </p>
      </div>
      <CertificateDownloadButton
        id={certificate.id}
        downloader={downloader}
        ariaLabel={`Descargar ${CERTIFICATE_KIND_LABEL[certificate.kind].toLowerCase()}: ${certificate.title}`}
      />
    </li>
  );
}

/**
 * Certificado de la ruta completa (o cuántos módulos faltan) y la lista de certificados emitidos,
 * cada uno con su código de verificación y el enlace a la página pública.
 */
export function CertificatesPanel({
  certificates,
  route,
  downloader,
}: {
  certificates: readonly CertificateSummary[];
  route: RouteCertificate;
  downloader: CertificateDownload;
}) {
  const modules = certificates.filter((certificate) => certificate.kind !== CertificateKind.Route);
  return (
    <Card title="Certificados">
      <section className={styles.route} aria-label="Certificado de la ruta completa">
        <h3 className={styles.routeTitle}>Certificado de la ruta completa</h3>
        {route.certificate ? (
          <ul className={styles.list}>
            <CertificateItem certificate={route.certificate} downloader={downloader} />
          </ul>
        ) : (
          <p className={styles.routeText}>
            {route.missing === 1
              ? 'Te falta 1 módulo para descargarlo.'
              : `Te faltan ${route.missing} módulos para descargarlo.`}
          </p>
        )}
      </section>
      <h3 className={styles.routeTitle}>Certificados de módulo</h3>
      {modules.length === 0 ? (
        <p className={styles.empty}>
          Todavía no tienes certificados de módulo. Aparecerán al terminar uno.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Certificados de módulo emitidos">
          {modules.map((certificate) => (
            <CertificateItem
              key={certificate.id}
              certificate={certificate}
              downloader={downloader}
            />
          ))}
        </ul>
      )}
      <p className={styles.verify}>
        ¿Quieres comprobar un certificado? <Link href={VERIFY_HREF}>Verificar un certificado</Link>
      </p>
    </Card>
  );
}

'use client';

import { TeacherModuleState } from '@gns/shared';
import Link from 'next/link';

import { LoadError, Loading } from '@/shared/data';
import { useSession } from '@/shared/session';
import { Card, DataTable, Icon, StatusBadge, type DataTableColumn } from '@/shared/ui';

import { useCertificateDownload } from '../hooks/use-certificate-download';
import { useTrainingProgress, type TrainingProgressData } from '../hooks/use-training-route';
import { MODULE_STATE_INFO } from '../model/labels';
import { progressRows, routeCertificate, type ProgressRow, type StepCell } from '../model/progress';
import { CertificateDownloadButton, CertificateDownloadError } from './certificate-download-button';
import { CertificatesPanel } from './certificates-panel';
import { moduleHref } from './module-card';
import styles from './progress-screen.module.css';
import { TrainingPage } from './training-header';

function StepValue({ cell, yes, no }: { cell: StepCell; yes: string; no: string }) {
  if (cell === 'not_applicable') {
    return <span className={styles.na}>No aplica</span>;
  }
  return cell === 'viewed' ? (
    <span className={styles.yes}>
      <Icon name="check" size={15} />
      {yes}
    </span>
  ) : (
    <span className={styles.no}>{no}</span>
  );
}

function CertificateName() {
  const { state } = useSession();
  const name = state.status === 'authenticated' ? state.user.fullName : null;
  return (
    <Card title="Mis datos para el certificado">
      <p className={styles.nameLabel}>Nombre completo como aparece en tus certificados</p>
      <p className={styles.name}>{name ?? '—'}</p>
      <p className={styles.hint}>
        Este nombre es de solo lectura. Si necesita una corrección, pídesela a la administración de
        la plataforma.
      </p>
    </Card>
  );
}

function ProgressContent({ data }: { data: TrainingProgressData }) {
  const downloader = useCertificateDownload();
  const rows = progressRows(data.route, data.certificates);
  const { certificate, missing } = routeCertificate(data.route, data.certificates);

  const columns: DataTableColumn<ProgressRow>[] = [
    {
      key: 'module',
      header: 'Módulo',
      render: (row) => (
        <Link href={moduleHref(row.moduleId)} className={styles.moduleLink}>
          {row.title}
        </Link>
      ),
    },
    {
      key: 'video',
      header: 'Video',
      render: (row) => <StepValue cell={row.video} yes="Visto" no="No visto" />,
    },
    {
      key: 'challenge',
      header: 'Desafío GNS',
      render: (row) =>
        row.challenge.kind === 'not_applicable' ? (
          <span className={styles.na}>No aplica</span>
        ) : row.challenge.score === null ? (
          <span className={styles.no}>—</span>
        ) : (
          <span>{`${row.challenge.score}%`}</span>
        ),
    },
    {
      key: 'presentation',
      header: 'Presentación',
      render: (row) => <StepValue cell={row.presentation} yes="Revisada" no="No revisada" />,
    },
    {
      key: 'activities',
      header: 'Actividades',
      render: (row) =>
        row.requiredTotal === 0 ? (
          <span className={styles.na}>—</span>
        ) : (
          `${row.requiredDone} de ${row.requiredTotal} obligatorias`
        ),
    },
    {
      key: 'state',
      header: 'Estado',
      render: (row) => (
        <StatusBadge tone={MODULE_STATE_INFO[row.state].tone}>
          {MODULE_STATE_INFO[row.state].label}
        </StatusBadge>
      ),
    },
    {
      key: 'certificate',
      header: 'Certificado',
      render: (row) =>
        row.state === TeacherModuleState.Done && row.certificateId ? (
          <CertificateDownloadButton
            id={row.certificateId}
            downloader={downloader}
            ariaLabel={`Descargar certificado de ${row.title}`}
          />
        ) : (
          <span className={styles.no}>—</span>
        ),
    },
  ];

  return (
    <div className={styles.stack}>
      <CertificateName />
      <Card title="Seguimiento por módulo">
        <DataTable
          embedded
          caption="Seguimiento por módulo"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.moduleId}
          emptyMessage="Aún no tienes módulos en tu ruta."
        />
      </Card>
      <CertificateDownloadError downloader={downloader} />
      <CertificatesPanel
        certificates={data.certificates}
        route={{ certificate, missing }}
        downloader={downloader}
      />
    </div>
  );
}

/** «Mi progreso y certificados»: una fila por módulo, el nombre del certificado y los emitidos. */
export function TrainingProgressScreen() {
  const { state, reload } = useTrainingProgress();

  return (
    <TrainingPage active="progress">
      {state.status === 'loading' ? (
        <Loading>Cargando tu progreso…</Loading>
      ) : state.status === 'error' ? (
        <LoadError error={state.error} onRetry={reload} />
      ) : (
        <ProgressContent data={state.data} />
      )}
    </TrainingPage>
  );
}

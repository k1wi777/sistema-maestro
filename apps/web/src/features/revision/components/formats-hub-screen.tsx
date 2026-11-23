'use client';

import Link from 'next/link';

import { LoadError } from '@/shared/data';
import { useView } from '@/shared/shell';
import { FormatCard, Notice, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { useFormatsOverview } from '../hooks/use-format-inbox';
import { useInboxViewer } from '../hooks/use-inbox-viewer';
import { useRevisionPaths } from '../hooks/use-revision-paths';
import { pendingLabel, reviewFormatCards, totalLabel } from '../model/format-cards';
import styles from './formats-hub-screen.module.css';

/**
 * Hub de «Formatos» de coordinación y administración: una tarjeta por formato. Coordinación ve sus
 * pendientes «en tus grados»; administración consulta, con el total de registros y un aviso por
 * cada grado sin coordinadora.
 */
export function ReviewFormatsHubScreen() {
  const view = useView();
  const paths = useRevisionPaths();
  const viewer = useInboxViewer();
  const overview = useFormatsOverview(viewer);
  const data = overview.state.status === 'ready' ? overview.state.data : null;
  const cards = reviewFormatCards(paths, viewer.isAdministrator);

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Formatos"
        description={
          viewer.isAdministrator
            ? 'Consulta las planeaciones, los diarios de campo (F-PA-05) y las anotaciones del observador de todo el colegio. La revisión es de la coordinadora de cada grado.'
            : 'Revisa las planeaciones, los diarios de campo (F-PA-05) y las anotaciones del observador de tus grados, y consulta los del resto del colegio.'
        }
      />
      <div className={styles.notices}>
        {overview.state.status === 'error' ? (
          <LoadError
            error={overview.state.error}
            title="No pudimos cargar las cifras"
            onRetry={overview.reload}
          />
        ) : null}
        {viewer.isAdministrator
          ? (data?.uncovered ?? []).map((grade) => (
              <Notice key={grade.id} tone="warning" title="Grado sin coordinadora">
                {`${grade.name} no tiene coordinadora: sus registros enviados no tienen quién los revise. Asígnale una en `}
                <Link href={paths.grades}>Grados y áreas</Link>.
              </Notice>
            ))
          : null}
      </div>
      <ul className={styles.grid}>
        {cards.map((card) => (
          <li key={card.id}>
            <FormatCard
              title={card.title}
              description={card.description}
              icon={card.icon}
              href={card.href}
              badge={
                data ? (
                  viewer.isAdministrator ? (
                    <StatusBadge tone="neutral">
                      {totalLabel(data.counts[card.pending])}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone={data.counts[card.pending] > 0 ? 'warning' : 'neutral'}>
                      {pendingLabel(data.counts[card.pending])}
                    </StatusBadge>
                  )
                ) : null
              }
            />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

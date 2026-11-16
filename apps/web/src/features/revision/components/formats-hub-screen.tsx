'use client';

import { LoadError } from '@/shared/data';
import { FormatCard, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { usePendingCounts } from '../hooks/use-format-inbox';
import { pendingLabel, REVIEW_FORMAT_CARDS } from '../model/format-cards';
import styles from './formats-hub-screen.module.css';

/** Hub de «Formatos» de coordinación: una tarjeta por formato con sus pendientes de revisión. */
export function ReviewFormatsHubScreen() {
  const pending = usePendingCounts();
  const counts = pending.state.status === 'ready' ? pending.state.data : null;

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Formatos"
        description="Revisa las planeaciones, los diarios de campo (F-PA-05) y las anotaciones del observador: devuélvelos con observaciones o apruébalos con tu firma."
      />
      {pending.state.status === 'error' ? (
        <LoadError
          error={pending.state.error}
          title="No pudimos contar los pendientes"
          onRetry={pending.reload}
        />
      ) : null}
      <ul className={styles.grid}>
        {REVIEW_FORMAT_CARDS.map((card) => (
          <li key={card.id}>
            <FormatCard
              title={card.title}
              description={card.description}
              icon={card.icon}
              href={card.href}
              badge={
                counts ? (
                  <StatusBadge tone={counts[card.pending] > 0 ? 'warning' : 'neutral'}>
                    {pendingLabel(counts[card.pending])}
                  </StatusBadge>
                ) : null
              }
            />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

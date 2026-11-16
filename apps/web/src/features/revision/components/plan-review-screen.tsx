'use client';

import type { LessonPlan, Review } from '@gns/shared';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatDateRange, formatDateTime, formatShortDate } from '@/shared/format/dates';
import { STATUS_INFO } from '@/shared/records';
import { ButtonLink, Card, Notice, PageContainer, PageHeader, StatusBadge } from '@/shared/ui';

import { usePlanReview, usePlanReviewData } from '../hooks/use-plan-review';
import { planSections } from '../model/plan-blocks';
import { planFiltersFromParams, planFiltersToQuery } from '../model/plan-filters';
import { PLAN_INBOX_PATH } from '../model/paths';
import { ReviewBlock } from './review-block';
import { ReviewPanel } from './review-panel';
import styles from './plan-review-screen.module.css';

function NotFound({
  error,
  onRetry,
  backHref,
}: {
  error: ApiError;
  onRetry: () => void;
  backHref: string;
}) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta planeación">
        Puede que ya no exista o que el enlace esté incompleto.{' '}
        <ButtonLink href={backHref} variant="outline" size="sm">
          Volver a Planeaciones
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function ResourcesList({ plan }: { plan: LessonPlan }) {
  if (plan.linkedResources.length === 0) {
    return <p className={styles.muted}>El docente no agregó recursos digitales.</p>;
  }
  return (
    <ul className={styles.resources}>
      {plan.linkedResources.map((resource) => (
        <li key={resource.id}>
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            {resource.name ?? resource.url}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
          <span className={styles.muted}>
            {[resource.tool, resource.moment ? `Momento ${resource.moment}` : 'General'].join(
              ' · ',
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface PlanReviewProps {
  plan: LessonPlan;
  reviews: Review[];
  refresh: () => Promise<ApiError | null>;
  backQuery: string;
}

function PlanReview({ plan, reviews, refresh, backQuery }: PlanReviewProps) {
  const review = usePlanReview({ plan, reviews, refresh, backQuery });
  const info = STATUS_INFO[plan.status];
  const dates = formatDateRange(plan.dateFrom, plan.dateTo);
  const backHref = backQuery ? `${PLAN_INBOX_PATH}?${backQuery}` : PLAN_INBOX_PATH;
  const { resubmission } = review;

  return (
    <PageContainer>
      <div className={styles.back}>
        <ButtonLink href={backHref} variant="outline" size="sm" startIcon="volver">
          Planeaciones
        </ButtonLink>
      </div>
      <PageHeader
        context="Revisión de planeación"
        title={`${plan.area.name} · ${plan.topic ?? 'Sin tema'}`}
        description={[
          plan.teacher.fullName,
          plan.grade.name,
          `Periodo ${plan.period.number}`,
          dates,
          plan.crossCuttingProject ? `Proyecto ${plan.crossCuttingProject}` : null,
        ]
          .filter((entry): entry is string => Boolean(entry))
          .join(' · ')}
        actions={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      />

      {review.blockedReason ? (
        <Notice tone="info" className={styles.notice}>
          {review.blockedReason}
        </Notice>
      ) : null}
      {resubmission ? (
        <Notice
          tone="info"
          title={`Reenviada el ${formatShortDate(resubmission.resubmittedAt)}`}
          className={styles.notice}
        >
          {`${plan.teacher.fullName} respondió a tu observación del ${formatDateTime(resubmission.returnedAt)}`}
          {resubmission.changedBlocks.length > 0
            ? ' y cambió contenido que habías ajustado: revisa los bloques marcados «Cambió desde tu ajuste».'
            : '.'}
        </Notice>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.content}>
          {planSections(plan.level.name).map((section) => (
            <Card key={section.id} title={section.title}>
              {section.id === 'digitales' ? (
                <ResourcesList plan={plan} />
              ) : (
                section.blocks.map((block) => (
                  <ReviewBlock key={block.key} block={block} plan={plan} review={review} />
                ))
              )}
            </Card>
          ))}
        </div>
        <ReviewPanel plan={plan} review={review} />
      </div>
    </PageContainer>
  );
}

/** Revisión de una planeación (`/coordinacion/formatos/planeaciones/[id]`): el contenido se lee primero. */
export function PlanReviewScreen({ id }: { id: string }) {
  const { params } = useQueryParams();
  const backQuery = planFiltersToQuery(planFiltersFromParams(params));
  const backHref = backQuery ? `${PLAN_INBOX_PATH}?${backQuery}` : PLAN_INBOX_PATH;
  const remote = usePlanReviewData(id);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la planeación…</Loading>
      </PageContainer>
    );
  }
  if (remote.state.status === 'error') {
    return (
      <PageContainer>
        <NotFound error={remote.state.error} onRetry={remote.reload} backHref={backHref} />
      </PageContainer>
    );
  }
  return (
    <PlanReview
      key={id}
      plan={remote.state.data.plan}
      reviews={remote.state.data.reviews}
      refresh={remote.refresh}
      backQuery={backQuery}
    />
  );
}

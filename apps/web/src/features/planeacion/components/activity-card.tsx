import type { SharedActivity } from '@gns/shared';
import { useId, useState } from 'react';

import { Button, ButtonLink, Icon, RecordCard, StatusBadge } from '@/shared/ui';

import { ACTIVITY_TYPE_LABELS } from '../model/activity-types';
import styles from './activity-card.module.css';

interface ActivityCardProps {
  activity: SharedActivity;
  /** Si el usuario en sesión es el autor: puede editarla y retirarla. */
  own: boolean;
  onToggleFavorite: (activity: SharedActivity) => void;
  onEdit: (activity: SharedActivity) => void;
  onWithdraw: (activity: SharedActivity) => void;
}

/** Solo enlaces http o https se pintan como enlace. */
function safeHref(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function ActivityCard({
  activity,
  own,
  onToggleFavorite,
  onEdit,
  onWithdraw,
}: ActivityCardProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const href = safeHref(activity.link);
  const meta = [
    activity.grade?.name ?? 'Todo el nivel',
    activity.area?.name,
    activity.learningCorner,
    activity.durationMinutes ? `${activity.durationMinutes} min` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <li className={styles.item}>
      <RecordCard
        title={activity.title}
        headingLevel={3}
        status={
          <button
            type="button"
            className={styles.star}
            aria-pressed={activity.isFavorite}
            aria-label={
              activity.isFavorite
                ? `Quitar «${activity.title}» de favoritas`
                : `Marcar «${activity.title}» como favorita`
            }
            onClick={() => onToggleFavorite(activity)}
          >
            <Icon name="estrella" size={20} fill={activity.isFavorite ? 'solid' : 'none'} />
          </button>
        }
        meta={meta}
        actions={
          <>
            <Button
              context={`(actividad «${activity.title}»)`}
              variant="outline"
              size="sm"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ocultar' : 'Ver detalle'}
            </Button>
            <ButtonLink
              context={`(actividad «${activity.title}»)`}
              href={`/docente/planeacion/nueva?actividad=${activity.id}`}
              variant="secondary"
              size="sm"
            >
              Usar en mi planeación
            </ButtonLink>
            {own ? (
              <>
                <Button
                  context={`actividad «${activity.title}»`}
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(activity)}
                >
                  Editar
                </Button>
                <Button
                  context={`actividad «${activity.title}»`}
                  variant="void"
                  size="sm"
                  onClick={() => onWithdraw(activity)}
                >
                  Retirar
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <div className={styles.tags}>
          <StatusBadge tone="info">{ACTIVITY_TYPE_LABELS[activity.activityType]}</StatusBadge>
          {activity.level ? <StatusBadge>{activity.level.name}</StatusBadge> : null}
        </div>
        {activity.objective ? <p className={styles.objective}>{activity.objective}</p> : null}
        <div id={detailId} hidden={!open} className={styles.detail}>
          {activity.materials ? (
            <>
              <b>Materiales</b>
              <p>{activity.materials}</p>
            </>
          ) : null}
          <b>Paso a paso</b>
          <p>{activity.steps}</p>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
              <Icon name="externo" size={16} />
              Abrir recurso
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          ) : null}
        </div>
        <p className={styles.author}>
          {activity.author.fullName}
          {own ? ' · tuya' : ''}
        </p>
      </RecordCard>
    </li>
  );
}

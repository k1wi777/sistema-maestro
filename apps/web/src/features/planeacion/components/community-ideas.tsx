import type { LessonPlan, SharedActivity } from '@gns/shared';
import { useState } from 'react';

import { ActionMenu, ButtonLink, Button, Notice, Select, StatusBadge } from '@/shared/ui';

import { useSharedActivities } from '../hooks/use-shared-activities';
import { ACTIVITY_TYPE_LABELS } from '../model/activity-types';
import { MOMENTS, type MomentField } from '../model/steps';
import { LoadError, Loading } from '@/shared/data';
import styles from './community-ideas.module.css';
import { REPOSITORY_PATH } from '../model/paths';

const IDEAS_PAGE_SIZE = 5;

export interface IdeaUseResult {
  ok: boolean;
  message: string;
}

interface CommunityIdeasProps {
  /** Planeación guardada: de ella salen el grado, las áreas y el rincón de las ideas. */
  plan: Pick<LessonPlan, 'grade' | 'areas' | 'learningCorner'>;
  /** Agrega la idea al final del momento elegido y dice cómo salió. */
  onUse: (field: MomentField, activity: SharedActivity) => IdeaUseResult;
}

const MOMENT_ITEMS = MOMENTS.map((moment) => ({
  field: moment.field,
  label: `${moment.number} · ${moment.short}`,
}));

/** «Ideas de la comunidad» del paso Momentos: actividades del grado, de una de las áreas y del rincón de la planeación. */
export function CommunityIdeas({ plan, onUse }: CommunityIdeasProps) {
  const corner = plan.learningCorner?.trim() || undefined;
  // El docente puede pedir ver las ideas del grado sin filtrar por rincón.
  const [ignoreCorner, setIgnoreCorner] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const withCorner = corner !== undefined && !ignoreCorner;
  // Las ideas son de una sola área a la vez: la primera de la planeación hasta que el docente elija otra.
  const [chosenAreaId, setChosenAreaId] = useState('');
  const area = plan.areas.find((candidate) => candidate.id === chosenAreaId) ?? plan.areas[0];

  const list = useSharedActivities(
    {
      gradeId: plan.grade.id,
      areaId: area?.id,
      learningCorner: withCorner ? corner : undefined,
    },
    IDEAS_PAGE_SIZE,
  );

  function pickMoment(field: MomentField, activity: SharedActivity) {
    setAnnouncement(onUse(field, activity).message);
  }

  return (
    <aside className={styles.panel} aria-labelledby="ideas-title">
      <h3 id="ideas-title" className={styles.title}>
        Ideas de la comunidad
      </h3>
      <p className={styles.scope}>
        {[plan.grade.name, area?.name, withCorner ? corner : null].filter(Boolean).join(' · ')}
      </p>

      {plan.areas.length > 1 ? (
        <Select
          label="Área de las ideas"
          options={plan.areas.map((option) => ({ value: option.id, label: option.name }))}
          value={area?.id ?? ''}
          onChange={(event) => setChosenAreaId(event.target.value)}
        />
      ) : null}

      <p className={styles.live} role="status">
        {announcement}
      </p>

      {list.status === 'loading' ? <Loading>Buscando ideas…</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError error={list.error} title="No pudimos cargar las ideas" onRetry={list.reload} />
      ) : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <Notice tone="info">
          <p className={styles.empty}>
            {withCorner
              ? `Aún no hay ideas para el rincón «${corner}».`
              : 'Aún no hay ideas para este grado y área.'}
          </p>
          {withCorner ? (
            <Button variant="outline" size="sm" onClick={() => setIgnoreCorner(true)}>
              Ver ideas de todo el grado
            </Button>
          ) : null}
        </Notice>
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <ul className={styles.list}>
          {list.items.map((activity) => (
            <li key={activity.id} className={styles.card}>
              <div className={styles.tags}>
                <StatusBadge tone="info">{ACTIVITY_TYPE_LABELS[activity.activityType]}</StatusBadge>
              </div>
              <h4 className={styles.name}>{activity.title}</h4>
              {activity.objective ? <p className={styles.objective}>{activity.objective}</p> : null}
              <p className={styles.author}>{activity.author.fullName}</p>
              <ActionMenu
                label="Usar en mi planeación"
                ariaLabel={`Usar «${activity.title}» en mi planeación`}
                variant="secondary"
                size="sm"
                items={MOMENT_ITEMS.map((item) => ({
                  id: item.field,
                  label: item.label,
                  onSelect: () => pickMoment(item.field, activity),
                }))}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.more}>
        <ButtonLink href={REPOSITORY_PATH} variant="outline" size="sm" endIcon="flecha">
          Ver todo el repositorio
        </ButtonLink>
      </div>
    </aside>
  );
}

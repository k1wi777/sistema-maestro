import type { TeacherActivity } from '@gns/shared';
import { TrainingActivityType } from '@gns/shared';

import { Notice, StatusBadge } from '@/shared/ui';

import { ACTIVITY_TYPE_LABEL } from '../model/labels';
import styles from './activities-section.module.css';

function progressText(activity: TeacherActivity): string {
  const { progress } = activity;
  if (activity.type === TrainingActivityType.WheelPassport) {
    return progress.completedAt
      ? 'Pasaporte completo'
      : `${progress.stamps.length} de ${activity.config.tarjetas.length} sellos conseguidos`;
  }
  if (progress.completedAt) {
    return progress.bestScore === null
      ? 'Terminada'
      : `Terminada · mejor resultado ${progress.bestScore}%`;
  }
  return progress.bestScore === null ? 'Sin empezar' : `Mejor resultado ${progress.bestScore}%`;
}

/**
 * Actividades del módulo en el orden que definió coordinación. En esta entrega solo se listan: el
 * juego de cada una llega en la siguiente y reemplazará el cuerpo de cada tarjeta.
 */
export function ActivitiesSection({ activities }: { activities: TeacherActivity[] }) {
  return (
    <ul className={styles.list}>
      {activities.map((activity) => (
        <li key={activity.id} className={styles.card}>
          <div className={styles.top}>
            <span className={styles.kind}>{ACTIVITY_TYPE_LABEL[activity.type]}</span>
            <StatusBadge tone={activity.isRequired ? 'warning' : 'neutral'}>
              {activity.isRequired ? 'Obligatoria' : 'Opcional'}
            </StatusBadge>
          </div>
          <h3 className={styles.title}>{activity.title}</h3>
          <p className={styles.state}>{progressText(activity)}</p>
          {activity.instructions ? <p className={styles.text}>{activity.instructions}</p> : null}
          <Notice tone="info">El juego de esta actividad llega en la próxima entrega.</Notice>
        </li>
      ))}
    </ul>
  );
}

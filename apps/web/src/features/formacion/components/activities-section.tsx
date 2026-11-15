'use client';

import { TrainingActivityType, type TeacherActivity } from '@gns/shared';

import { Notice, StatusBadge } from '@/shared/ui';

import type { ActivityBlock } from '../model/activity-blocks';
import { activityBlocks } from '../model/activity-blocks';
import { progressText } from '../model/activity-progress';
import { ACTIVITY_TYPE_LABEL } from '../model/labels';
import styles from './activities-section.module.css';
import { MatchGame } from './match-game';
import { SimulatorBlock } from './simulator-block';
import { TrueOrMythGame } from './true-or-myth-game';
import { WheelPassport } from './wheel-passport';

function Game({ activity, onProgress }: { activity: TeacherActivity; onProgress: () => void }) {
  switch (activity.type) {
    case TrainingActivityType.WheelPassport:
      return <WheelPassport activity={activity} onProgress={onProgress} />;
    case TrainingActivityType.Match:
      return <MatchGame activity={activity} onProgress={onProgress} />;
    case TrainingActivityType.TrueOrMyth:
      return <TrueOrMythGame activity={activity} onProgress={onProgress} />;
    case TrainingActivityType.Simulator:
      return null;
  }
}

function Head({
  kind,
  title,
  badge,
  state,
  text,
}: {
  kind: string;
  title: string;
  badge: { tone: 'warning' | 'neutral'; label: string } | null;
  state?: string;
  text?: string | null;
}) {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.kind}>{kind}</span>
        {badge ? <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> : null}
      </div>
      <h3 className={styles.title}>{title}</h3>
      {state ? <p className={styles.state}>{state}</p> : null}
      {text ? <p className={styles.text}>{text}</p> : null}
    </>
  );
}

const requiredBadge = (isRequired: boolean) =>
  isRequired
    ? ({ tone: 'warning', label: 'Obligatoria' } as const)
    : ({ tone: 'neutral', label: 'Opcional' } as const);

function Block({ block, onProgress }: { block: ActivityBlock; onProgress: () => void }) {
  if (block.kind === 'simulators') {
    const [first] = block.simulators;
    if (block.simulators.length === 1 && first) {
      const { activity } = first;
      return (
        <article className={styles.card}>
          <Head
            kind={ACTIVITY_TYPE_LABEL[activity.type]}
            title={activity.title}
            badge={requiredBadge(activity.isRequired)}
            state={progressText(activity)}
            text={activity.instructions}
          />
          <SimulatorBlock simulators={block.simulators} hideHeader onProgress={onProgress} />
        </article>
      );
    }
    const required = block.simulators.filter((item) => item.activity.isRequired).length;
    const all = required === block.simulators.length;
    const none = required === 0;
    return (
      <article className={styles.card}>
        <Head
          kind="Simulador"
          title={`Simuladores${all ? ' · obligatorios' : none ? ' · opcionales' : ''}`}
          badge={
            all || none
              ? { tone: all ? 'warning' : 'neutral', label: all ? 'Obligatorios' : 'Opcionales' }
              : null
          }
        />
        <SimulatorBlock simulators={block.simulators} onProgress={onProgress} />
      </article>
    );
  }

  const { activity } = block;
  return (
    <article className={styles.card}>
      <Head
        kind={ACTIVITY_TYPE_LABEL[activity.type]}
        title={activity.title}
        badge={requiredBadge(activity.isRequired)}
        state={progressText(activity)}
        text={activity.instructions}
      />
      {block.kind === 'unavailable' ? (
        <Notice tone="warning">Esta actividad no está disponible.</Notice>
      ) : (
        <Game activity={activity} onProgress={onProgress} />
      )}
    </article>
  );
}

/**
 * Actividades del módulo en el orden que definió coordinación, cada una con su juego. Ninguna se
 * bloquea por el estado de las demás; cada acción pide `onProgress` para actualizar el avance, «Para
 * terminar» y el estado del módulo con lo que decide la API, sin desmontar los juegos.
 */
export function ActivitiesSection({
  activities,
  onProgress,
}: {
  activities: TeacherActivity[];
  onProgress: () => void;
}) {
  return (
    <div className={styles.list}>
      {activityBlocks(activities).map((block) => (
        <Block key={block.key} block={block} onProgress={onProgress} />
      ))}
    </div>
  );
}

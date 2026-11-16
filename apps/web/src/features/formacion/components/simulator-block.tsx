'use client';

import { useState } from 'react';

import { emojiIcon, Icon, SegmentedFilter, StatusBadge } from '@/shared/ui';
import {
  sharedKey,
  SimulatorPanel,
  type SharedValues,
  type SimulatorChangeHandler,
} from '@/shared/training-games';

import type { ParsedSimulator } from '../model/activity-blocks';
import { progressText } from '../model/activity-progress';
import { useSimulatorUse } from '../hooks/use-simulator-use';
import { MarkError } from './mark-controls';
import styles from './simulator-block.module.css';

type ChangeHandler = SimulatorChangeHandler;

function Panel({
  simulator,
  shared,
  onChange,
  showHeader,
}: {
  simulator: ParsedSimulator;
  shared: SharedValues;
  onChange: ChangeHandler;
  showHeader: boolean;
}) {
  const { activity, config } = simulator;
  return (
    <div className={styles.panel}>
      {showHeader ? (
        <div className={styles.header}>
          <h4 className={styles.title}>{activity.title}</h4>
          <StatusBadge tone={activity.isRequired ? 'warning' : 'neutral'}>
            {activity.isRequired ? 'Obligatorio' : 'Opcional'}
          </StatusBadge>
          <p className={styles.state}>{progressText(activity)}</p>
          {activity.instructions ? <p className={styles.text}>{activity.instructions}</p> : null}
        </div>
      ) : null}
      <SimulatorPanel config={config} shared={shared} onChange={onChange} />
    </div>
  );
}

/**
 * Uno o varios simuladores seguidos. Lo escrito vive solo en el estado de este bloque (por clave y
 * tipo, así «Salario mensual» pasa de un simulador a otro) y nunca sale del navegador: a la API solo
 * llega el aviso de uso, sin datos, la primera vez que se cambia una entrada de cada simulador.
 */
export function SimulatorBlock({
  simulators,
  hideHeader,
  onProgress,
}: {
  simulators: ParsedSimulator[];
  /** El título, la marca y el avance ya los pinta quien lo contiene (un solo simulador). */
  hideHeader?: boolean;
  onProgress: () => void;
}) {
  const [selectedId, setSelectedId] = useState(simulators[0]?.activity.id ?? '');
  const [shared, setShared] = useState<SharedValues>({});
  const use = useSimulatorUse(onProgress);
  const selected =
    simulators.find((item) => item.activity.id === selectedId) ?? simulators[0] ?? null;

  if (!selected) {
    return null;
  }
  const mixed = new Set(simulators.map((item) => item.activity.isRequired)).size > 1;

  const onChange: ChangeHandler = (input, value) => {
    setShared((current) => {
      const next = { ...current };
      if (value === null) {
        delete next[sharedKey(input)];
      } else {
        next[sharedKey(input)] = value;
      }
      return next;
    });
    use.markUsed(selected.activity.id);
  };

  return (
    <div className={styles.block}>
      {simulators.length > 1 ? (
        <SegmentedFilter
          label="Simulador"
          className={styles.selector}
          options={simulators.map((item) => ({
            value: item.activity.id,
            label:
              mixed && item.activity.isRequired
                ? `${item.activity.title} (obligatorio)`
                : item.activity.title,
            icon: emojiIcon(item.config.icono),
          }))}
          value={selected.activity.id}
          onChange={setSelectedId}
        />
      ) : null}
      <Panel
        key={selected.activity.id}
        simulator={selected}
        shared={shared}
        onChange={onChange}
        showHeader={!hideHeader}
      />
      <p className={styles.privacy}>
        <Icon name="candado" size={14} />
        Tus datos no se guardan ni se envían: solo se usan en esta pantalla.
      </p>
      {use.failure ? (
        <MarkError error={use.failure.error} busy={use.busy} onRetry={use.retry} />
      ) : null}
    </div>
  );
}

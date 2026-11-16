import { AreaType } from '@gns/shared';
import { useId } from 'react';

import { Checkbox, Icon } from '@/shared/ui';

import styles from './area-checklist.module.css';

export interface AreaChoice {
  id: string;
  name: string;
  type: string;
  /** El docente la tiene asignada en el grado. */
  assigned?: boolean;
}

/** Tipo de las áreas que la planeación ya tiene pero ya no se ofrecen (p. ej. se retiró la asignación). */
export const SAVED_AREA_TYPE = 'guardada';

const GROUPS: { type: string; label: string }[] = [
  { type: AreaType.Dimension, label: 'Dimensiones' },
  { type: AreaType.Subject, label: 'Asignaturas' },
  { type: SAVED_AREA_TYPE, label: 'Ya guardadas en la planeación' },
];

interface AreaChecklistProps {
  areas: readonly AreaChoice[];
  selected: readonly string[];
  onChange: (areaIds: string[]) => void;
  disabled?: boolean;
  error?: string;
}

/** Casillas de dimensiones y asignaturas: la planeación puede trabajar una o varias. */
export function AreaChecklist({ areas, selected, onChange, disabled, error }: AreaChecklistProps) {
  const errorId = useId();
  return (
    <fieldset
      className={styles.fieldset}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className={styles.legend}>Dimensiones o asignaturas</legend>
      {GROUPS.map((group) => {
        const options = areas.filter((area) => area.type === group.type);
        return options.length === 0 ? null : (
          <fieldset key={group.type} className={styles.group}>
            <legend className={styles.groupLegend}>{group.label}</legend>
            <div className={styles.checks}>
              {options.map((area) => (
                <Checkbox
                  key={area.id}
                  label={area.name}
                  help={area.assigned ? 'Asignada' : undefined}
                  checked={selected.includes(area.id)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, area.id]
                        : selected.filter((id) => id !== area.id),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        );
      })}
      {error ? (
        <p id={errorId} className={styles.error}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

import { CuriocityStage, levelAllowsCuriocity } from '@gns/shared';
import { useEffect, useRef, type ReactNode } from 'react';

import { Card, Select, TextArea, TextInput } from '@/shared/ui';

import { FIELD_MAX_LENGTH } from '../../model/form-state';
import { MOMENTS, type MomentField } from '../../model/steps';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

/** Pide llevar el foco al cuadro de un momento; el `nonce` distingue peticiones repetidas. */
export interface MomentFocusRequest {
  field: MomentField;
  nonce: number;
}

interface MomentsStepProps extends StepProps {
  /** «Ideas de la comunidad», al lado en computador y debajo en celular. */
  ideas?: ReactNode;
  focusRequest?: MomentFocusRequest | null;
}

const STAGE_OPTIONS = Object.values(CuriocityStage).map((stage) => ({
  value: stage,
  label: stage,
}));

export function MomentsStep({
  plan,
  draft,
  errors,
  readOnly,
  onChange,
  number,
  ideas,
  focusRequest,
}: MomentsStepProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const curiocity = levelAllowsCuriocity(plan.level.name);

  useEffect(() => {
    if (focusRequest) {
      listRef.current
        ?.querySelector<HTMLTextAreaElement>(`[data-moment="${focusRequest.field}"] textarea`)
        ?.focus();
    }
  }, [focusRequest]);

  return (
    <Card title="Momentos de la clase" step={number}>
      <div className={styles.layout}>
        <div className={styles.layoutInner}>
          <div>
            {curiocity ? (
              <Select
                label="Etapa CurioCity"
                placeholder="Sin etapa"
                options={STAGE_OPTIONS}
                value={draft.curiocityStage}
                disabled={readOnly}
                error={errors.curiocityStage}
                onChange={(event) => onChange('curiocityStage', event.target.value)}
              />
            ) : (
              <TextInput
                label="Rincón o zona"
                maxLength={FIELD_MAX_LENGTH.learningCorner}
                placeholder="Ej. Sweet Home"
                help="Opcional. Con él podrás encontrar ideas de la comunidad para ese rincón."
                value={draft.learningCorner}
                readOnly={readOnly}
                error={errors.learningCorner}
                onChange={(event) => onChange('learningCorner', event.target.value)}
              />
            )}
            <ol className={styles.moments} ref={listRef}>
              {MOMENTS.map((moment) => (
                <li key={moment.field} className={styles.moment} data-moment={moment.field}>
                  <span className={styles.number} aria-hidden="true">
                    {moment.number}
                  </span>
                  <TextArea
                    label={`Momento ${moment.number} · ${moment.title}`}
                    required={moment.field === 'developmentMoment'}
                    maxLength={FIELD_MAX_LENGTH.text}
                    value={draft[moment.field]}
                    readOnly={readOnly}
                    error={errors[moment.field]}
                    onChange={(event) => onChange(moment.field, event.target.value)}
                  />
                </li>
              ))}
            </ol>
          </div>
          {ideas}
        </div>
      </div>
    </Card>
  );
}

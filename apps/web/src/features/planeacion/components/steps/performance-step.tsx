import { Card, TextArea } from '@/shared/ui';

import { FIELD_MAX_LENGTH } from '../../model/form-state';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

export function PerformanceStep({ draft, errors, readOnly, onChange, number }: StepProps) {
  return (
    <Card title="Desempeño esperado" step={number}>
      <div className={styles.fields}>
        <TextArea
          label="Desempeño esperado"
          required
          maxLength={FIELD_MAX_LENGTH.text}
          placeholder="Ej. Nombra cómo se siente usando la ruleta de emociones y propone una forma de calmarse."
          help="Es obligatorio para enviar la planeación a coordinación."
          value={draft.expectedPerformance}
          readOnly={readOnly}
          error={errors.expectedPerformance}
          onChange={(event) => onChange('expectedPerformance', event.target.value)}
        />
      </div>
    </Card>
  );
}

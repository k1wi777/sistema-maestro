import { Card, TextArea } from '@/shared/ui';

import { FIELD_MAX_LENGTH } from '../../model/form-state';
import { PrivacyNotice } from '../privacy-notice';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

export function ResourcesStep({ draft, errors, readOnly, onChange, number }: StepProps) {
  return (
    <Card title="Recursos y ajustes razonables" step={number}>
      <div className={styles.fields}>
        <TextArea
          label="Recursos y materiales"
          maxLength={FIELD_MAX_LENGTH.text}
          value={draft.resources}
          readOnly={readOnly}
          error={errors.resources}
          onChange={(event) => onChange('resources', event.target.value)}
        />
        <TextArea
          label="Ajustes razonables"
          maxLength={FIELD_MAX_LENGTH.text}
          value={draft.reasonableAdjustments}
          readOnly={readOnly}
          error={errors.reasonableAdjustments}
          onChange={(event) => onChange('reasonableAdjustments', event.target.value)}
        />
        <PrivacyNotice context="adjustments" />
      </div>
    </Card>
  );
}

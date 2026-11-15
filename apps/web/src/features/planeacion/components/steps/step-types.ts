import type { LessonPlan } from '@gns/shared';

import type { FormErrors, FormField, FormValues } from '../../model/form-state';

/** Lo que recibe cada paso de contenido del editor. */
export interface StepProps {
  plan: LessonPlan;
  draft: FormValues;
  errors: FormErrors;
  /** En enviada, revisada o anulada todo se muestra sin poder editarse. */
  readOnly: boolean;
  onChange: (field: FormField, value: string) => void;
  /** Número que lleva el paso en la tarjeta. */
  number: number;
}

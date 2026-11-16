import { crossCuttingProjectFor, lessonPlanAreasLabel } from '@gns/shared';

import { Card, Select, TextInput } from '@/shared/ui';

import type { CatalogPeriod } from '../../api/catalogs';
import {
  FIELD_MAX_LENGTH,
  areaIdsToValue,
  dateRangeError,
  valueToAreaIds,
} from '../../model/form-state';
import { AreaChecklist, SAVED_AREA_TYPE, type AreaChoice } from '../area-checklist';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

interface GeneralStepProps extends StepProps {
  /** Periodos del año vigente; `null` si no se pudieron cargar (el periodo queda fijo). */
  periods: CatalogPeriod[] | null;
  /** Áreas que el docente puede marcar en el grado de la planeación; `null` si no se pudieron cargar. */
  areaOptions: AreaChoice[] | null;
}

export function GeneralStep({
  plan,
  draft,
  errors,
  readOnly,
  onChange,
  number,
  periods,
  areaOptions,
}: GeneralStepProps) {
  const periodNumber =
    periods?.find((period) => period.id === draft.periodId)?.number ?? plan.period.number;
  const project = crossCuttingProjectFor(plan.level.name, periodNumber);
  const rangeError = dateRangeError(draft);
  // Las áreas ya guardadas se ofrecen siempre, aunque hoy no estén entre las del grado.
  const offered = areaOptions ?? [];
  const choices: AreaChoice[] = [
    ...offered,
    ...plan.areas
      .filter((area) => !offered.some((option) => option.id === area.id))
      .map((area) => ({ id: area.id, name: area.name, type: SAVED_AREA_TYPE })),
  ];
  const periodOptions = (periods ?? [{ id: plan.period.id, number: plan.period.number }]).map(
    (period) => ({ value: period.id, label: `Periodo ${period.number}` }),
  );

  return (
    <Card title="Datos generales" step={number}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Docente</dt>
          <dd>{plan.teacher.fullName}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Nivel</dt>
          <dd>{plan.level.name}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Grado</dt>
          <dd>{plan.grade.name}</dd>
        </div>
        {readOnly ? (
          <div className={styles.fact}>
            <dt>Dimensiones o asignaturas</dt>
            <dd>{lessonPlanAreasLabel(plan.areas)}</dd>
          </div>
        ) : null}
        <div className={styles.fact}>
          <dt>Proyecto transversal</dt>
          <dd>{project ?? 'Sin proyecto en este periodo'}</dd>
        </div>
      </dl>
      <div className={styles.grid}>
        <Select
          label="Periodo"
          options={periodOptions}
          value={draft.periodId}
          disabled={readOnly || periods === null}
          error={errors.periodId}
          onChange={(event) => onChange('periodId', event.target.value)}
        />
        <div />
        {readOnly ? null : (
          <div className={styles.full}>
            <AreaChecklist
              areas={choices}
              selected={valueToAreaIds(draft.areaIds)}
              error={errors.areaIds}
              onChange={(areaIds) => onChange('areaIds', areaIdsToValue(areaIds))}
            />
          </div>
        )}
        <TextInput
          label="Desde"
          type="date"
          value={draft.dateFrom}
          readOnly={readOnly}
          error={errors.dateFrom}
          onChange={(event) => onChange('dateFrom', event.target.value)}
        />
        <TextInput
          label="Hasta"
          type="date"
          value={draft.dateTo}
          readOnly={readOnly}
          error={errors.dateTo ?? rangeError ?? undefined}
          onChange={(event) => onChange('dateTo', event.target.value)}
        />
        <div className={styles.full}>
          <TextInput
            label="Proyecto o tema"
            maxLength={FIELD_MAX_LENGTH.topic}
            placeholder="Ej. Proyecto mensual «Mi cuerpo en movimiento»"
            value={draft.topic}
            readOnly={readOnly}
            error={errors.topic}
            onChange={(event) => onChange('topic', event.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

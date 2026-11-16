'use client';

import { Button, SegmentedFilter, TextArea, TextInput } from '@/shared/ui';

import { errorsUnder } from '../../model/activity-form';
import {
  emptyStatement,
  perGameHint,
  type StatementForm,
  type TrueOrMythForm as TrueOrMythFormValues,
} from '../../model/true-or-myth-form';
import styles from './activity-editor.module.css';
import {
  ListControls,
  moveItem,
  removeItem,
  replaceItem,
  type TypeFormProps,
} from './list-controls';

const MAX_STATEMENTS = 60;

const ANSWER_OPTIONS = [
  { value: 'verdad', label: 'Verdad' },
  { value: 'mito', label: 'Mito' },
];

/** ¿Verdad o mito?: de 1 a 60 afirmaciones y las reglas de la partida. */
export function TrueOrMythForm({
  form,
  errors,
  disabled,
  onChange,
}: TypeFormProps<TrueOrMythFormValues>) {
  const hint = perGameHint(form);
  const setStatement = (index: number, statement: StatementForm) =>
    onChange({ ...form, statements: replaceItem(form.statements, index, statement) });

  return (
    <div className={styles.fields}>
      <div className={styles.grid}>
        <TextInput
          label="Afirmaciones por partida"
          required
          inputMode="numeric"
          value={form.perGame}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.por_partida']}
          onChange={(event) => onChange({ ...form, perGame: event.target.value })}
        />
        <TextInput
          label="Vidas"
          required
          inputMode="numeric"
          value={form.lives}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.vidas']}
          onChange={(event) => onChange({ ...form, lives: event.target.value })}
        />
        <TextInput
          label="Segundos por afirmación"
          required
          inputMode="numeric"
          value={form.seconds}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.segundos_por_afirmacion']}
          onChange={(event) => onChange({ ...form, seconds: event.target.value })}
        />
        <TextInput
          label="Porcentaje para aprobar"
          required
          inputMode="numeric"
          value={form.threshold}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.umbral_aprobacion']}
          onChange={(event) => onChange({ ...form, threshold: event.target.value })}
        />
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{`Afirmaciones (1 a ${MAX_STATEMENTS})`}</legend>
        {hint ? (
          <p className={styles.hintWarning} aria-live="polite">
            {hint}
          </p>
        ) : null}
        {errors['config.afirmaciones'] ? (
          <p className={styles.listError}>{errors['config.afirmaciones']}</p>
        ) : null}
        <ol className={styles.items}>
          {form.statements.map((statement, index) => {
            const name = `afirmación ${index + 1}`;
            const statementErrors = errorsUnder(errors, `config.afirmaciones.${index}`);
            return (
              <li
                key={index}
                className={`${styles.item} ${statementErrors.length > 0 ? styles.itemInvalid : ''}`}
              >
                <p className={styles.itemTitle}>{`Afirmación ${index + 1}`}</p>
                <TextArea
                  label="Afirmación"
                  required
                  rows={2}
                  value={statement.text}
                  maxLength={300}
                  disabled={disabled}
                  error={errors[`config.afirmaciones.${index}.texto`]}
                  onChange={(event) =>
                    setStatement(index, { ...statement, text: event.target.value })
                  }
                />
                <SegmentedFilter
                  label={`Respuesta de la ${name}`}
                  options={ANSWER_OPTIONS}
                  value={statement.isTrue ? 'verdad' : 'mito'}
                  onChange={(value) =>
                    setStatement(index, { ...statement, isTrue: value === 'verdad' })
                  }
                />
                <TextArea
                  label="Explicación (se ve después de responder)"
                  required
                  rows={2}
                  value={statement.explanation}
                  maxLength={300}
                  disabled={disabled}
                  error={errors[`config.afirmaciones.${index}.explicacion`]}
                  onChange={(event) =>
                    setStatement(index, { ...statement, explanation: event.target.value })
                  }
                />
                <ListControls
                  name={name}
                  index={index}
                  count={form.statements.length}
                  disabled={disabled}
                  canRemove={form.statements.length > 1}
                  onMove={(offset) =>
                    onChange({ ...form, statements: moveItem(form.statements, index, offset) })
                  }
                  onRemove={() =>
                    onChange({ ...form, statements: removeItem(form.statements, index) })
                  }
                />
              </li>
            );
          })}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || form.statements.length >= MAX_STATEMENTS}
            onClick={() =>
              onChange({ ...form, statements: [...form.statements, emptyStatement()] })
            }
          >
            Agregar afirmación
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

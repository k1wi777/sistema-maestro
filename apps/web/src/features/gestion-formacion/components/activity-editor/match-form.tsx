'use client';

import { Button, IconPicker, TextInput } from '@/shared/ui';

import { errorsUnder } from '../../model/activity-form';
import {
  emptyPair,
  pairsNeeded,
  type MatchForm as MatchFormValues,
  type PairForm,
} from '../../model/match-form';
import styles from './activity-editor.module.css';
import {
  ListControls,
  moveItem,
  removeItem,
  replaceItem,
  type TypeFormProps,
} from './list-controls';

const MAX_PAIRS = 40;

/** Conecta: de 2 a 40 pares (concepto, dato e icono opcional) y las reglas de la partida. */
export function MatchForm({ form, errors, disabled, onChange }: TypeFormProps<MatchFormValues>) {
  const needed = pairsNeeded(form);
  const setPair = (index: number, pair: PairForm) =>
    onChange({ ...form, pairs: replaceItem(form.pairs, index, pair) });
  const listError = errors['config.pares'];

  return (
    <div className={styles.fields}>
      <div className={styles.grid}>
        <TextInput
          label="Pares por ronda"
          required
          inputMode="numeric"
          value={form.perRound}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.pares_por_ronda']}
          onChange={(event) => onChange({ ...form, perRound: event.target.value })}
        />
        <TextInput
          label="Rondas"
          required
          inputMode="numeric"
          value={form.rounds}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.rondas']}
          onChange={(event) => onChange({ ...form, rounds: event.target.value })}
        />
        <TextInput
          label="Segundos por ronda"
          required
          inputMode="numeric"
          value={form.seconds}
          disabled={disabled}
          autoComplete="off"
          error={errors['config.segundos_por_ronda']}
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
        <legend className={styles.groupTitle}>{`Pares (2 a ${MAX_PAIRS})`}</legend>
        {needed.needed !== null ? (
          <p className={needed.enough ? styles.hintOk : styles.hintWarning} aria-live="polite">
            {`Necesitas al menos ${form.perRound.trim()} × ${form.rounds.trim()} = ${needed.needed} pares (tienes ${needed.have}).`}
          </p>
        ) : null}
        {listError && needed.enough ? <p className={styles.listError}>{listError}</p> : null}
        <ol className={styles.items}>
          {form.pairs.map((pair, index) => {
            const name = `par ${index + 1}`;
            const pairErrors = errorsUnder(errors, `config.pares.${index}`);
            return (
              <li
                key={index}
                className={`${styles.item} ${pairErrors.length > 0 ? styles.itemInvalid : ''}`}
              >
                <p className={styles.itemTitle}>{`Par ${index + 1}`}</p>
                <div className={styles.pairRow}>
                  <TextInput
                    label="Concepto"
                    required
                    value={pair.concept}
                    maxLength={80}
                    disabled={disabled}
                    autoComplete="off"
                    error={errors[`config.pares.${index}.concepto`]}
                    onChange={(event) => setPair(index, { ...pair, concept: event.target.value })}
                  />
                  <TextInput
                    label="Dato"
                    required
                    value={pair.fact}
                    maxLength={200}
                    disabled={disabled}
                    autoComplete="off"
                    error={errors[`config.pares.${index}.dato`]}
                    onChange={(event) => setPair(index, { ...pair, fact: event.target.value })}
                  />
                  <IconPicker
                    label="Icono"
                    allowNone
                    value={pair.emoji}
                    error={errors[`config.pares.${index}.emoji`]}
                    onChange={(emoji) => setPair(index, { ...pair, emoji })}
                  />
                </div>
                <ListControls
                  name={name}
                  index={index}
                  count={form.pairs.length}
                  disabled={disabled}
                  canRemove={form.pairs.length > 2}
                  onMove={(offset) =>
                    onChange({ ...form, pairs: moveItem(form.pairs, index, offset) })
                  }
                  onRemove={() => onChange({ ...form, pairs: removeItem(form.pairs, index) })}
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
            disabled={disabled || form.pairs.length >= MAX_PAIRS}
            onClick={() => onChange({ ...form, pairs: [...form.pairs, emptyPair()] })}
          >
            Agregar par
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

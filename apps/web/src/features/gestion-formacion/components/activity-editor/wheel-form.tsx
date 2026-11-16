'use client';

import { useId, useState } from 'react';

import { Button, IconPicker, Notice, StatusBadge, TextArea, TextInput } from '@/shared/ui';

import { errorsUnder } from '../../model/activity-form';
import {
  emptyCard,
  removeOption,
  type WheelCardForm,
  type WheelForm as WheelFormValues,
} from '../../model/wheel-form';
import styles from './activity-editor.module.css';
import {
  ListControls,
  moveItem,
  removeItem,
  replaceItem,
  type TypeFormProps,
} from './list-controls';

const MAX_CARDS = 20;
const MIN_CARDS = 2;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_FACTS = 6;

function CardFields({
  card,
  path,
  errors,
  disabled,
  onChange,
}: {
  card: WheelCardForm;
  path: string;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (card: WheelCardForm) => void;
}) {
  const radioName = useId();
  const set = (patch: Partial<WheelCardForm>) => onChange({ ...card, ...patch });
  const error = (field: string) => errors[`${path}.${field}`];

  return (
    <div className={styles.fields}>
      <div className={styles.grid2}>
        <TextInput
          label="Título corto (sello)"
          required
          value={card.shortTitle}
          maxLength={40}
          disabled={disabled}
          autoComplete="off"
          error={error('titulo_corto')}
          onChange={(event) => set({ shortTitle: event.target.value })}
        />
        <IconPicker
          label="Icono"
          value={card.emoji}
          error={error('emoji')}
          onChange={(emoji) => set({ emoji: emoji ?? '' })}
        />
      </div>
      <TextInput
        label="Título"
        required
        value={card.title}
        maxLength={80}
        disabled={disabled}
        autoComplete="off"
        error={error('titulo')}
        onChange={(event) => set({ title: event.target.value })}
      />
      <TextInput
        label="Dato clave"
        required
        value={card.fact}
        maxLength={200}
        disabled={disabled}
        autoComplete="off"
        error={error('dato')}
        onChange={(event) => set({ fact: event.target.value })}
      />
      <TextArea
        label="Hechos (uno por línea)"
        help={`De 1 a ${MAX_FACTS} hechos; cada línea es un hecho.`}
        required
        rows={4}
        value={card.facts}
        disabled={disabled}
        error={errorsUnder(errors, `${path}.hechos`)[0]}
        onChange={(event) => set({ facts: event.target.value })}
      />
      <div className={styles.grid2}>
        <TextInput
          label="Texto del enlace (opcional)"
          value={card.linkText}
          maxLength={60}
          disabled={disabled}
          autoComplete="off"
          error={error('enlace.texto')}
          onChange={(event) => set({ linkText: event.target.value })}
        />
        <TextInput
          label="Dirección del enlace (https)"
          value={card.linkUrl}
          maxLength={500}
          inputMode="url"
          disabled={disabled}
          autoComplete="off"
          error={error('enlace.url')}
          onChange={(event) => set({ linkUrl: event.target.value })}
        />
      </div>
      <TextInput
        label="Pregunta del sello"
        required
        value={card.question}
        maxLength={200}
        disabled={disabled}
        autoComplete="off"
        error={error('pregunta.enunciado')}
        onChange={(event) => set({ question: event.target.value })}
      />
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          {`Opciones: elige la correcta (${MIN_OPTIONS} a ${MAX_OPTIONS})`}
        </legend>
        {errorsUnder(errors, `${path}.pregunta.opciones`).length > 0 &&
        card.options.every((option) => option.trim() !== '') ? (
          <p className={styles.listError}>{errorsUnder(errors, `${path}.pregunta.opciones`)[0]}</p>
        ) : null}
        {error('pregunta.correcta') ? (
          <p className={styles.listError}>{error('pregunta.correcta')}</p>
        ) : null}
        {card.options.map((option, index) => (
          <div key={index} className={styles.optionRow}>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name={radioName}
                checked={card.correct === index}
                disabled={disabled}
                aria-label={`Correcta opción ${index + 1}`}
                onChange={() => set({ correct: index })}
              />
              Correcta
            </label>
            <TextInput
              label={`Opción ${index + 1}`}
              value={option}
              maxLength={120}
              disabled={disabled}
              autoComplete="off"
              error={error(`pregunta.opciones.${index}`)}
              onChange={(event) =>
                set({
                  options: replaceItem(card.options, index, event.target.value),
                })
              }
            />
            <Button
              context={`opción ${index + 1}`}
              variant="outline"
              size="sm"
              disabled={disabled || card.options.length <= MIN_OPTIONS}
              onClick={() => onChange(removeOption(card, index))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || card.options.length >= MAX_OPTIONS}
            onClick={() => set({ options: [...card.options, ''] })}
          >
            Agregar opción
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

/**
 * Ruleta y pasaporte: insignia y de 2 a 20 tarjetas. Una tarjeta abierta a la vez; las demás son una
 * fila resumen. Una tarjeta con errores se abre sola al validar.
 */
export function WheelForm({
  form,
  errors,
  disabled,
  onChange,
  existing,
}: TypeFormProps<WheelFormValues>) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const invalid = form.cards.findIndex(
    (_, index) => errorsUnder(errors, `config.tarjetas.${index}`).length > 0,
  );
  const [lastInvalid, setLastInvalid] = useState(-1);
  if (invalid !== lastInvalid) {
    setLastInvalid(invalid);
    if (invalid >= 0 && invalid !== openIndex) {
      setOpenIndex(invalid);
    }
  }

  const setCards = (cards: WheelCardForm[]) => onChange({ ...form, cards });
  const listError = errors['config.tarjetas'];

  function move(index: number, offset: -1 | 1) {
    setCards(moveItem(form.cards, index, offset));
    if (openIndex === index) {
      setOpenIndex(index + offset);
    } else if (openIndex === index + offset) {
      setOpenIndex(index);
    }
  }

  function remove(index: number) {
    setCards(removeItem(form.cards, index));
    setOpenIndex(null);
  }

  return (
    <div className={styles.fields}>
      <TextInput
        label="Insignia (se gana con todos los sellos)"
        required
        value={form.badge}
        maxLength={80}
        disabled={disabled}
        autoComplete="off"
        error={errors['config.insignia']}
        onChange={(event) => onChange({ ...form, badge: event.target.value })}
      />
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{`Tarjetas (${MIN_CARDS} a ${MAX_CARDS})`}</legend>
        {listError ? <p className={styles.listError}>{listError}</p> : null}
        {existing ? (
          <Notice tone="warning">
            Quitar una tarjeta retira ese sello del pasaporte de los docentes que ya lo ganaron.
          </Notice>
        ) : null}
        <ol className={styles.items}>
          {form.cards.map((card, index) => {
            const open = openIndex === index;
            const cardErrors = errorsUnder(errors, `config.tarjetas.${index}`);
            const name = `tarjeta ${index + 1}`;
            return (
              <li
                key={index}
                className={`${styles.item} ${cardErrors.length > 0 ? styles.itemInvalid : ''}`}
              >
                <div className={styles.itemHead}>
                  <p className={styles.itemTitle}>
                    {`Tarjeta ${index + 1} · ${card.shortTitle.trim() || 'Sin título corto'}`}
                  </p>
                  {cardErrors.length > 0 ? (
                    <StatusBadge tone="danger">Revisa esta tarjeta</StatusBadge>
                  ) : null}
                  <Button
                    context={`${name}`}
                    variant="outline"
                    size="sm"
                    startIcon="lapiz"
                    aria-expanded={open}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    {open ? 'Cerrar' : 'Editar'}
                  </Button>
                </div>
                {open ? (
                  <CardFields
                    card={card}
                    path={`config.tarjetas.${index}`}
                    errors={errors}
                    disabled={disabled}
                    onChange={(next) => setCards(replaceItem(form.cards, index, next))}
                  />
                ) : null}
                <ListControls
                  name={name}
                  index={index}
                  count={form.cards.length}
                  disabled={disabled}
                  canRemove={form.cards.length > MIN_CARDS}
                  onMove={(offset) => move(index, offset)}
                  onRemove={() => remove(index)}
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
            disabled={disabled || form.cards.length >= MAX_CARDS}
            onClick={() => {
              setCards([...form.cards, emptyCard()]);
              setOpenIndex(form.cards.length);
            }}
          >
            Agregar tarjeta
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

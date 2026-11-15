'use client';

import type { SimulatorConfig, SimulatorInput } from '@gns/shared';
import { useId, useState } from 'react';

import { Icon, SegmentedFilter, StatusBadge, TextInput } from '@/shared/ui';

import type { ParsedSimulator } from '../model/activity-blocks';
import { progressText } from '../model/activity-progress';
import { emojiIcon } from '../model/emoji-icons';
import {
  evaluateWith,
  formatInputValue,
  formatMoneyInput,
  formatSimulatorValue,
  inputValueOf,
  NOT_CALCULABLE,
  parseMoneyInput,
  sharedKey,
  type SharedValues,
} from '../model/simulator';
import { useSimulatorUse } from '../hooks/use-simulator-use';
import { MarkError } from './mark-controls';
import styles from './simulator-block.module.css';

type ChangeHandler = (input: SimulatorInput, value: number | null) => void;

function MoneyField({
  input,
  shared,
  onChange,
}: {
  input: Extract<SimulatorInput, { tipo: 'moneda' }>;
  shared: SharedValues;
  onChange: ChangeHandler;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = inputValueOf(input, shared);
  const shown = draft ?? (value === undefined ? '' : formatMoneyInput(value));

  return (
    <TextInput
      label={input.unidad ? `${input.etiqueta} (${input.unidad})` : input.etiqueta}
      inputMode="numeric"
      autoComplete="off"
      maxLength={17}
      value={shown}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(input, parseMoneyInput(event.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function RangeField({
  input,
  shared,
  onChange,
}: {
  input: Extract<SimulatorInput, { tipo: 'numero' | 'porcentaje' }>;
  shared: SharedValues;
  onChange: ChangeHandler;
}) {
  const id = useId();
  const value = inputValueOf(input, shared) ?? input.inicial;
  const text = formatInputValue(input, value);
  return (
    <div className={styles.range}>
      <label htmlFor={id}>
        {input.etiqueta} <b>{text}</b>
      </label>
      <input
        id={id}
        type="range"
        min={input.min}
        max={input.max}
        step={input.paso}
        value={value}
        aria-valuetext={text}
        onChange={(event) => onChange(input, Number(event.target.value))}
      />
    </div>
  );
}

function OptionField({
  input,
  shared,
  onChange,
}: {
  input: Extract<SimulatorInput, { tipo: 'opcion' }>;
  shared: SharedValues;
  onChange: ChangeHandler;
}) {
  const value = inputValueOf(input, shared) ?? input.inicial;
  return (
    <div className={styles.option}>
      <span className={styles.optionLabel}>{input.etiqueta}</span>
      <SegmentedFilter
        label={input.etiqueta}
        options={input.opciones.map((option) => ({
          value: String(option.valor),
          label: option.etiqueta,
        }))}
        value={String(value)}
        onChange={(next) => onChange(input, Number(next))}
      />
    </div>
  );
}

function Field(props: { input: SimulatorInput; shared: SharedValues; onChange: ChangeHandler }) {
  const { input, shared, onChange } = props;
  if (input.tipo === 'moneda') {
    return <MoneyField input={input} shared={shared} onChange={onChange} />;
  }
  if (input.tipo === 'opcion') {
    return <OptionField input={input} shared={shared} onChange={onChange} />;
  }
  return <RangeField input={input} shared={shared} onChange={onChange} />;
}

function Value({ text }: { text: string }) {
  return text === NOT_CALCULABLE ? (
    <>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">no se puede calcular con estos datos</span>
    </>
  ) : (
    <>{text}</>
  );
}

/** Resultados recalculados en el navegador con `evaluateSimulator` de `@gns/shared`. */
function Results({ config, shared }: { config: SimulatorConfig; shared: SharedValues }) {
  const evaluation = evaluateWith(config, shared);
  const featured = config.destacado
    ? evaluation.resultados.find((result) => result.clave === config.destacado?.clave)
    : undefined;
  const rows = evaluation.resultados.filter((result) => result !== featured);

  return (
    <div className={styles.results}>
      {featured && config.destacado ? (
        <p className={styles.big} aria-live="polite" aria-atomic="true">
          <span className={styles.bigLabel}>{featured.etiqueta}</span>
          <b>
            <Value text={formatSimulatorValue(featured.valor, featured.formato)} />
          </b>
          <small>{config.destacado.subtitulo}</small>
        </p>
      ) : null}
      {rows.length > 0 ? (
        <dl className={styles.rows}>
          {rows.map((result) => (
            <div key={result.clave} className={styles.row}>
              <dt>{result.etiqueta}</dt>
              <dd>
                <Value text={formatSimulatorValue(result.valor, result.formato)} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {evaluation.notas.map((note) => (
        <p key={note} className={styles.note}>
          {note}
        </p>
      ))}
    </div>
  );
}

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
      <div className={styles.columns}>
        <div className={styles.inputs}>
          {config.entradas.map((input) => (
            <Field key={input.clave} input={input} shared={shared} onChange={onChange} />
          ))}
        </div>
        <Results config={config} shared={shared} />
      </div>
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

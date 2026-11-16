'use client';

import type { SimulatorConfig, SimulatorInput } from '@gns/shared';
import { useId, useState } from 'react';

import { SegmentedFilter, TextInput } from '@/shared/ui';

import {
  evaluateWith,
  formatInputValue,
  formatMoneyInput,
  formatSimulatorValue,
  inputValueOf,
  NOT_CALCULABLE,
  parseMoneyInput,
  type SharedValues,
} from './simulator';
import styles from './simulator-panel.module.css';

export type SimulatorChangeHandler = (input: SimulatorInput, value: number | null) => void;

function MoneyField({
  input,
  shared,
  onChange,
}: {
  input: Extract<SimulatorInput, { tipo: 'moneda' }>;
  shared: SharedValues;
  onChange: SimulatorChangeHandler;
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
  onChange: SimulatorChangeHandler;
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
  onChange: SimulatorChangeHandler;
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

function Field(props: {
  input: SimulatorInput;
  shared: SharedValues;
  onChange: SimulatorChangeHandler;
}) {
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

/**
 * Entradas y resultados de un simulador. Los resultados se recalculan en el navegador con
 * `evaluateSimulator` de `@gns/shared`; los valores escritos viven en quien lo contiene.
 */
export function SimulatorPanel({
  config,
  shared,
  onChange,
}: {
  config: SimulatorConfig;
  shared: SharedValues;
  onChange: SimulatorChangeHandler;
}) {
  return (
    <div className={styles.columns}>
      <div className={styles.inputs}>
        {config.entradas.map((input) => (
          <Field key={input.clave} input={input} shared={shared} onChange={onChange} />
        ))}
      </div>
      <Results config={config} shared={shared} />
    </div>
  );
}

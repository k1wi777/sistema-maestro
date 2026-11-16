import type { SimulatorConfig, SimulatorInput, SimulatorResultFormat } from '@gns/shared';

import { fromExprNode, numberNode, renameRefs, toExprNode, type ExprNode } from './expression-tree';
import { numberText, optionalText, parseDecimal, requiredNumber } from './form-numbers';

export type InputKind = SimulatorInput['tipo'];

export interface OptionValueForm {
  label: string;
  value: string;
}

export interface SimulatorInputForm {
  key: string;
  /** Clave con la que hoy se refieren a esta entrada los cálculos: sigue a `key` salvo si está vacía. */
  anchor: string;
  label: string;
  kind: InputKind;
  unit: string;
  min: string;
  max: string;
  step: string;
  initial: string;
  options: OptionValueForm[];
  /** Posición de la opción inicial (solo en el tipo opción). */
  initialOption: number;
  screenOnly: boolean;
}

export interface SimulatorConstantForm {
  key: string;
  anchor: string;
  value: string;
}

export interface SimulatorCalculationForm {
  key: string;
  anchor: string;
  expression: ExprNode;
}

export interface SimulatorResultForm {
  /** Clave del cálculo que se muestra. */
  calculation: string;
  label: string;
  format: SimulatorResultFormat;
}

export interface SimulatorNoteForm {
  text: string;
  /** Cálculo que condiciona la nota; vacío = siempre. */
  when: string;
}

export interface SimulatorForm {
  inputs: SimulatorInputForm[];
  constants: SimulatorConstantForm[];
  calculations: SimulatorCalculationForm[];
  results: SimulatorResultForm[];
  /** Clave del resultado destacado; vacío = ninguno. */
  featured: string;
  featuredSubtitle: string;
  notes: SimulatorNoteForm[];
  icon: string | undefined;
}

export const INPUT_KIND_LABEL: Record<InputKind, string> = {
  moneda: 'Importe',
  numero: 'Número',
  porcentaje: 'Porcentaje',
  opcion: 'Opción',
};

export const RESULT_FORMAT_LABEL: Record<SimulatorResultFormat, string> = {
  moneda: 'Importe',
  porcentaje: 'Porcentaje',
  numero: 'Número',
  si_no: 'Sí o no',
};

/** Entrada nueva del tipo dado, con valores iniciales razonables; `base` conserva lo común. */
export function inputOfKind(
  kind: InputKind,
  base: Pick<SimulatorInputForm, 'key' | 'anchor' | 'label' | 'screenOnly'> = {
    key: '',
    anchor: '',
    label: '',
    screenOnly: false,
  },
): SimulatorInputForm {
  const common = {
    ...base,
    kind,
    unit: '',
    min: '0',
    max: '100',
    step: '1',
    initial: '0',
    options: [] as OptionValueForm[],
    initialOption: 0,
  };
  switch (kind) {
    case 'moneda':
      return { ...common, max: '', step: '1000', initial: '' };
    case 'opcion':
      return {
        ...common,
        options: [
          { label: '', value: '1' },
          { label: '', value: '2' },
        ],
      };
    default:
      return common;
  }
}

export function emptyInput(): SimulatorInputForm {
  return inputOfKind('numero', { key: 'valor', anchor: 'valor', label: '', screenOnly: false });
}

export function initialSimulatorForm(): SimulatorForm {
  return {
    inputs: [emptyInput()],
    constants: [],
    calculations: [],
    results: [],
    featured: '',
    featuredSubtitle: '',
    notes: [],
    icon: undefined,
  };
}

function inputToForm(input: SimulatorInput): SimulatorInputForm {
  const base = {
    key: input.clave,
    anchor: input.clave,
    label: input.etiqueta,
    screenOnly: input.solo_en_pantalla,
  };
  if (input.tipo === 'opcion') {
    return {
      ...inputOfKind('opcion', base),
      options: input.opciones.map((option) => ({
        label: option.etiqueta,
        value: numberText(option.valor),
      })),
      initialOption: Math.max(
        0,
        input.opciones.findIndex((option) => option.valor === input.inicial),
      ),
    };
  }
  return {
    ...inputOfKind(input.tipo, base),
    unit: input.unidad ?? '',
    min: numberText(input.min),
    max: numberText(input.max),
    step: numberText(input.paso),
    initial: numberText(input.inicial),
  };
}

export function simulatorToForm(config: SimulatorConfig): SimulatorForm {
  return {
    inputs: config.entradas.map(inputToForm),
    constants: config.constantes.map((constant) => ({
      key: constant.clave,
      anchor: constant.clave,
      value: numberText(constant.valor),
    })),
    calculations: config.calculos.map((calculation) => ({
      key: calculation.clave,
      anchor: calculation.clave,
      expression: toExprNode(calculation.expresion),
    })),
    results: config.resultados.map((result) => ({
      calculation: result.clave,
      label: result.etiqueta,
      format: result.formato,
    })),
    featured: config.destacado?.clave ?? '',
    featuredSubtitle: config.destacado?.subtitulo ?? '',
    notes: config.notas.map((note) => ({ text: note.texto, when: note.cuando ?? '' })),
    icon: config.icono,
  };
}

function inputFromForm(input: SimulatorInputForm): unknown {
  const base = {
    clave: input.key.trim(),
    etiqueta: input.label.trim(),
    solo_en_pantalla: input.screenOnly,
  };
  if (input.kind === 'opcion') {
    const selected = input.options[input.initialOption];
    return {
      ...base,
      tipo: 'opcion',
      opciones: input.options.map((option) => ({
        etiqueta: option.label.trim(),
        valor: requiredNumber(option.value),
      })),
      inicial: selected ? requiredNumber(selected.value) : Number.NaN,
    };
  }
  const unit = optionalText(input.unit);
  const range = {
    ...base,
    tipo: input.kind,
    ...(unit === undefined ? {} : { unidad: unit }),
    min: requiredNumber(input.min),
    paso: requiredNumber(input.step),
  };
  if (input.kind === 'moneda') {
    const max = parseDecimal(input.max);
    const initial = parseDecimal(input.initial);
    return {
      ...range,
      ...(max === undefined ? {} : { max }),
      ...(initial === undefined ? {} : { inicial: initial }),
    };
  }
  return { ...range, max: requiredNumber(input.max), inicial: requiredNumber(input.initial) };
}

export function simulatorFromForm(form: SimulatorForm): unknown {
  const featuredKey = form.featured.trim();
  const icon = form.icon === undefined ? undefined : optionalText(form.icon);
  return {
    entradas: form.inputs.map(inputFromForm),
    constantes: form.constants.map((constant) => ({
      clave: constant.key.trim(),
      valor: requiredNumber(constant.value),
    })),
    calculos: form.calculations.map((calculation) => ({
      clave: calculation.key.trim(),
      expresion: fromExprNode(calculation.expression),
    })),
    resultados: form.results.map((result) => ({
      clave: result.calculation,
      etiqueta: result.label.trim(),
      formato: result.format,
    })),
    notas: form.notes.map((note) => ({
      texto: note.text.trim(),
      ...(note.when === '' ? {} : { cuando: note.when }),
    })),
    ...(icon === undefined ? {} : { icono: icon }),
    ...(featuredKey === ''
      ? {}
      : { destacado: { clave: featuredKey, subtitulo: form.featuredSubtitle.trim() } }),
  };
}

export interface AvailableKeys {
  inputs: string[];
  constants: string[];
  /** Cálculos anteriores al que se edita. */
  previous: string[];
}

function filled(keys: string[]): string[] {
  return keys.filter((key) => key.trim() !== '');
}

/** Claves a las que puede referirse el cálculo `index`: entradas, constantes y cálculos anteriores. */
export function availableKeys(form: SimulatorForm, index: number): AvailableKeys {
  return {
    inputs: filled(form.inputs.map((input) => input.anchor)),
    constants: filled(form.constants.map((constant) => constant.anchor)),
    previous: filled(form.calculations.slice(0, index).map((calculation) => calculation.anchor)),
  };
}

export type KeyOwner = 'input' | 'constant' | 'calculation';

function renameInResults(form: SimulatorForm, from: string, to: string): SimulatorForm {
  return {
    ...form,
    results: form.results.map((result) =>
      result.calculation === from ? { ...result, calculation: to } : result,
    ),
    featured: form.featured === from ? to : form.featured,
    notes: form.notes.map((note) => (note.when === from ? { ...note, when: to } : note)),
  };
}

/**
 * Cambia la clave de una entrada, constante o cálculo y actualiza todas las referencias a ella
 * (cálculos, tramos, resultados, destacado y condiciones de las notas). Si la clave queda vacía
 * mientras se reescribe, las referencias siguen apuntando a la anterior hasta que haya una nueva.
 */
export function renameKey(
  form: SimulatorForm,
  owner: KeyOwner,
  index: number,
  key: string,
): SimulatorForm {
  const current = (
    owner === 'input' ? form.inputs : owner === 'constant' ? form.constants : form.calculations
  )[index];
  if (!current) {
    return form;
  }
  const trimmed = key.trim();
  const anchor = trimmed === '' ? current.anchor : trimmed;
  const rename = <Item extends { key: string; anchor: string }>(items: Item[]): Item[] =>
    items.map((item, position) => (position === index ? { ...item, key, anchor } : item));

  let next: SimulatorForm =
    owner === 'input'
      ? { ...form, inputs: rename(form.inputs) }
      : owner === 'constant'
        ? { ...form, constants: rename(form.constants) }
        : { ...form, calculations: rename(form.calculations) };

  if (anchor !== current.anchor) {
    next = {
      ...next,
      calculations: next.calculations.map((calculation) => ({
        ...calculation,
        expression: renameRefs(calculation.expression, current.anchor, anchor),
      })),
    };
    if (owner === 'calculation') {
      next = renameInResults(next, current.anchor, anchor);
    }
  }
  return next;
}

export function newCalculation(form: SimulatorForm): SimulatorCalculationForm {
  const taken = new Set([
    ...form.inputs.map((input) => input.anchor),
    ...form.constants.map((constant) => constant.anchor),
    ...form.calculations.map((calculation) => calculation.anchor),
  ]);
  let n = form.calculations.length + 1;
  while (taken.has(`calculo_${n}`)) {
    n += 1;
  }
  const key = `calculo_${n}`;
  return { key, anchor: key, expression: numberNode() };
}

/** Claves de cálculos que ya no existen (p. ej. tras quitar un cálculo) para limpiar resultados. */
export function dropCalculation(form: SimulatorForm, index: number): SimulatorForm {
  const removed = form.calculations[index];
  const calculations = form.calculations.filter((_, position) => position !== index);
  if (!removed) {
    return form;
  }
  const stillThere = new Set(calculations.map((calculation) => calculation.anchor));
  const key = removed.anchor;
  const keep = stillThere.has(key);
  return {
    ...form,
    calculations,
    results: keep ? form.results : form.results.filter((result) => result.calculation !== key),
    featured: keep || form.featured !== key ? form.featured : '',
    notes: form.notes.map((note) => (!keep && note.when === key ? { ...note, when: '' } : note)),
  };
}

'use client';

import { SIMULATOR_LIMITS, type SimulatorResultFormat } from '@gns/shared';

import {
  Button,
  Checkbox,
  IconPicker,
  Notice,
  Select,
  TextInput,
  type SelectOption,
} from '@/shared/ui';

import { errorsUnder } from '../../model/activity-form';
import { measure } from '../../model/expression-tree';
import {
  availableKeys,
  dropCalculation,
  emptyInput,
  INPUT_KIND_LABEL,
  inputOfKind,
  newCalculation,
  renameKey,
  RESULT_FORMAT_LABEL,
  type InputKind,
  type SimulatorForm as SimulatorFormValues,
  type SimulatorInputForm,
} from '../../model/simulator-form';
import styles from './activity-editor.module.css';
import { ExpressionEditor } from './expression-editor';
import {
  ListControls,
  moveItem,
  removeItem,
  replaceItem,
  type TypeFormProps,
} from './list-controls';

const MAX_OPTIONS = 6;
const MAX_RESULTS = 20;
const MAX_NOTES = 10;

const KIND_OPTIONS: SelectOption[] = (Object.keys(INPUT_KIND_LABEL) as InputKind[]).map((kind) => ({
  value: kind,
  label: INPUT_KIND_LABEL[kind],
}));

const FORMAT_OPTIONS: SelectOption[] = (
  Object.keys(RESULT_FORMAT_LABEL) as SimulatorResultFormat[]
).map((format) => ({ value: format, label: RESULT_FORMAT_LABEL[format] }));

function InputFields({
  input,
  index,
  errors,
  disabled,
  onKey,
  onChange,
}: {
  input: SimulatorInputForm;
  index: number;
  errors: Record<string, string>;
  disabled: boolean;
  onKey: (key: string) => void;
  onChange: (input: SimulatorInputForm) => void;
}) {
  const path = `config.entradas.${index}`;
  const error = (field: string) => errors[`${path}.${field}`];
  const set = (patch: Partial<SimulatorInputForm>) => onChange({ ...input, ...patch });
  const range = input.kind !== 'opcion';

  return (
    <div className={styles.fields}>
      <div className={styles.grid2}>
        <TextInput
          label="Clave"
          help="Letras minúsculas, números y _ (por ejemplo, salario)."
          required
          value={input.key}
          maxLength={32}
          disabled={disabled}
          autoComplete="off"
          error={error('clave')}
          onChange={(event) => onKey(event.target.value)}
        />
        <TextInput
          label="Etiqueta"
          required
          value={input.label}
          maxLength={80}
          disabled={disabled}
          autoComplete="off"
          error={error('etiqueta')}
          onChange={(event) => set({ label: event.target.value })}
        />
      </div>
      <div className={styles.grid2}>
        <Select
          label="Tipo de entrada"
          value={input.kind}
          options={KIND_OPTIONS}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              inputOfKind(event.target.value as InputKind, {
                key: input.key,
                anchor: input.anchor,
                label: input.label,
                screenOnly: input.screenOnly,
              }),
            )
          }
        />
        {range ? (
          <TextInput
            label="Unidad (opcional)"
            value={input.unit}
            maxLength={16}
            disabled={disabled}
            autoComplete="off"
            error={error('unidad')}
            onChange={(event) => set({ unit: event.target.value })}
          />
        ) : null}
      </div>
      {range ? (
        <div className={styles.grid}>
          <TextInput
            label={input.kind === 'moneda' ? 'Mínimo' : 'Mínimo'}
            required
            inputMode="decimal"
            value={input.min}
            disabled={disabled}
            autoComplete="off"
            error={error('min')}
            onChange={(event) => set({ min: event.target.value })}
          />
          <TextInput
            label={input.kind === 'moneda' ? 'Máximo (opcional)' : 'Máximo'}
            required={input.kind !== 'moneda'}
            inputMode="decimal"
            value={input.max}
            disabled={disabled}
            autoComplete="off"
            error={error('max')}
            onChange={(event) => set({ max: event.target.value })}
          />
          <TextInput
            label="Paso"
            required
            inputMode="decimal"
            value={input.step}
            disabled={disabled}
            autoComplete="off"
            error={error('paso')}
            onChange={(event) => set({ step: event.target.value })}
          />
          <TextInput
            label={input.kind === 'moneda' ? 'Valor inicial (opcional)' : 'Valor inicial'}
            required={input.kind !== 'moneda'}
            inputMode="decimal"
            value={input.initial}
            disabled={disabled}
            autoComplete="off"
            error={error('inicial')}
            onChange={(event) => set({ initial: event.target.value })}
          />
        </div>
      ) : (
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{`Opciones (2 a ${MAX_OPTIONS})`}</legend>
          {errorsUnder(errors, `${path}.opciones`).length > 0 &&
          !input.options.some((option) => option.label.trim() === '') ? (
            <p className={styles.listError}>{errorsUnder(errors, `${path}.opciones`)[0]}</p>
          ) : null}
          {input.options.map((option, position) => (
            <div key={position} className={styles.stepRow}>
              <TextInput
                label={`Etiqueta de la opción ${position + 1}`}
                value={option.label}
                maxLength={80}
                disabled={disabled}
                autoComplete="off"
                error={error(`opciones.${position}.etiqueta`)}
                onChange={(event) =>
                  set({
                    options: replaceItem(input.options, position, {
                      ...option,
                      label: event.target.value,
                    }),
                  })
                }
              />
              <TextInput
                label={`Valor de la opción ${position + 1}`}
                inputMode="decimal"
                value={option.value}
                disabled={disabled}
                autoComplete="off"
                error={error(`opciones.${position}.valor`)}
                onChange={(event) =>
                  set({
                    options: replaceItem(input.options, position, {
                      ...option,
                      value: event.target.value,
                    }),
                  })
                }
              />
              <Button
                context={`opción ${position + 1}`}
                variant="outline"
                size="sm"
                disabled={disabled || input.options.length <= 2}
                onClick={() =>
                  set({
                    options: removeItem(input.options, position),
                    initialOption:
                      input.initialOption === position
                        ? 0
                        : input.initialOption > position
                          ? input.initialOption - 1
                          : input.initialOption,
                  })
                }
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
              disabled={disabled || input.options.length >= MAX_OPTIONS}
              onClick={() => set({ options: [...input.options, { label: '', value: '' }] })}
            >
              Agregar opción
            </Button>
          </div>
          <Select
            label="Opción inicial"
            value={String(input.initialOption)}
            error={error('inicial')}
            options={input.options.map((option, position) => ({
              value: String(position),
              label: option.label.trim() || `Opción ${position + 1}`,
            }))}
            disabled={disabled}
            onChange={(event) => set({ initialOption: Number(event.target.value) })}
          />
        </fieldset>
      )}
      <Checkbox
        label="Solo en pantalla"
        help="Las entradas marcadas «solo en pantalla» nunca se guardan ni se envían."
        checked={input.screenOnly}
        disabled={disabled}
        onChange={(event) => set({ screenOnly: event.target.checked })}
      />
    </div>
  );
}

/**
 * Constructor del simulador: entradas, constantes, cálculos armados con operaciones del catálogo,
 * resultados, destacado, notas e icono. Se arma con datos, nunca con código.
 */
export function SimulatorForm({
  form,
  errors,
  disabled,
  onChange,
}: TypeFormProps<SimulatorFormValues>) {
  const calculationOptions: SelectOption[] = form.calculations
    .filter((calculation) => calculation.anchor.trim() !== '')
    .map((calculation) => ({
      value: calculation.anchor,
      label: calculation.key || calculation.anchor,
    }));
  const resultOptions: SelectOption[] = form.results
    .filter((result) => result.calculation !== '')
    .map((result) => ({
      value: result.calculation,
      label: result.label.trim() || result.calculation,
    }));

  return (
    <div className={styles.fields}>
      <Notice tone="info">
        El simulador se arma con datos, nunca con código: eliges entradas, constantes y cálculos, y
        el sistema calcula los resultados al momento. Los valores que escribe el docente no se
        guardan.
      </Notice>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          {`Entradas (1 a ${SIMULATOR_LIMITS.maxInputs})`}
        </legend>
        {errors['config.entradas'] ? (
          <p className={styles.listError}>{errors['config.entradas']}</p>
        ) : null}
        <ol className={styles.items}>
          {form.inputs.map((input, index) => (
            <li
              key={index}
              className={`${styles.item} ${errorsUnder(errors, `config.entradas.${index}`).length > 0 ? styles.itemInvalid : ''}`}
            >
              <p
                className={styles.itemTitle}
              >{`Entrada ${index + 1} · ${input.key || 'sin clave'}`}</p>
              <InputFields
                input={input}
                index={index}
                errors={errors}
                disabled={disabled}
                onKey={(key) => onChange(renameKey(form, 'input', index, key))}
                onChange={(next) =>
                  onChange({ ...form, inputs: replaceItem(form.inputs, index, next) })
                }
              />
              <ListControls
                name={`entrada ${index + 1}`}
                index={index}
                count={form.inputs.length}
                disabled={disabled}
                canRemove={form.inputs.length > 1}
                onMove={(offset) =>
                  onChange({ ...form, inputs: moveItem(form.inputs, index, offset) })
                }
                onRemove={() => onChange({ ...form, inputs: removeItem(form.inputs, index) })}
              />
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || form.inputs.length >= SIMULATOR_LIMITS.maxInputs}
            onClick={() => {
              const base = emptyInput();
              const taken = new Set(form.inputs.map((input) => input.anchor));
              let n = form.inputs.length + 1;
              while (taken.has(`entrada_${n}`)) {
                n += 1;
              }
              onChange({
                ...form,
                inputs: [...form.inputs, { ...base, key: `entrada_${n}`, anchor: `entrada_${n}` }],
              });
            }}
          >
            Agregar entrada
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          {`Constantes (0 a ${SIMULATOR_LIMITS.maxConstants})`}
        </legend>
        <ol className={styles.items}>
          {form.constants.map((constant, index) => (
            <li key={index} className={styles.item}>
              <div className={styles.grid2}>
                <TextInput
                  label={`Clave de la constante ${index + 1}`}
                  required
                  value={constant.key}
                  maxLength={32}
                  disabled={disabled}
                  autoComplete="off"
                  error={errors[`config.constantes.${index}.clave`]}
                  onChange={(event) =>
                    onChange(renameKey(form, 'constant', index, event.target.value))
                  }
                />
                <TextInput
                  label={`Valor de la constante ${index + 1}`}
                  required
                  inputMode="decimal"
                  value={constant.value}
                  disabled={disabled}
                  autoComplete="off"
                  error={errors[`config.constantes.${index}.valor`]}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      constants: replaceItem(form.constants, index, {
                        ...constant,
                        value: event.target.value,
                      }),
                    })
                  }
                />
              </div>
              <ListControls
                name={`constante ${index + 1}`}
                index={index}
                count={form.constants.length}
                disabled={disabled}
                onMove={(offset) =>
                  onChange({ ...form, constants: moveItem(form.constants, index, offset) })
                }
                onRemove={() => onChange({ ...form, constants: removeItem(form.constants, index) })}
              />
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || form.constants.length >= SIMULATOR_LIMITS.maxConstants}
            onClick={() => {
              const key = `constante_${form.constants.length + 1}`;
              onChange({
                ...form,
                constants: [...form.constants, { key, anchor: key, value: '0' }],
              });
            }}
          >
            Agregar constante
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          {`Cálculos (1 a ${SIMULATOR_LIMITS.maxCalculations})`}
        </legend>
        <p className={styles.help}>
          Un cálculo solo puede usar entradas, constantes y cálculos anteriores a él.
        </p>
        {errors['config.calculos'] ? (
          <p className={styles.listError}>{errors['config.calculos']}</p>
        ) : null}
        <ol className={styles.items}>
          {form.calculations.map((calculation, index) => {
            const calcErrors = errorsUnder(errors, `config.calculos.${index}`);
            const { nodes, depth } = measure(calculation.expression);
            return (
              <li
                key={index}
                className={`${styles.item} ${calcErrors.length > 0 ? styles.itemInvalid : ''}`}
              >
                <TextInput
                  label={`Clave del cálculo ${index + 1}`}
                  required
                  value={calculation.key}
                  maxLength={32}
                  disabled={disabled}
                  autoComplete="off"
                  error={errors[`config.calculos.${index}.clave`]}
                  onChange={(event) =>
                    onChange(renameKey(form, 'calculation', index, event.target.value))
                  }
                />
                <ExpressionEditor
                  node={calculation.expression}
                  name={`cálculo ${index + 1}`}
                  keys={availableKeys(form, index)}
                  root={calculation.expression}
                  level={1}
                  disabled={disabled}
                  onChange={(expression) =>
                    onChange({
                      ...form,
                      calculations: replaceItem(form.calculations, index, {
                        ...calculation,
                        expression,
                      }),
                    })
                  }
                />
                <p className={styles.help}>
                  {`${nodes} de ${SIMULATOR_LIMITS.maxNodes} nodos · profundidad ${depth} de ${SIMULATOR_LIMITS.maxDepth}`}
                </p>
                {errors[`config.calculos.${index}.expresion`] ? (
                  <p className={styles.listError}>{errors[`config.calculos.${index}.expresion`]}</p>
                ) : null}
                {calcErrors.filter(
                  (message) => message !== errors[`config.calculos.${index}.clave`],
                ).length > 0 && !errors[`config.calculos.${index}.expresion`] ? (
                  <p className={styles.listError}>
                    {calcErrors.find(
                      (message) => message !== errors[`config.calculos.${index}.clave`],
                    )}
                  </p>
                ) : null}
                <ListControls
                  name={`cálculo ${index + 1}`}
                  index={index}
                  count={form.calculations.length}
                  disabled={disabled}
                  onMove={(offset) =>
                    onChange({ ...form, calculations: moveItem(form.calculations, index, offset) })
                  }
                  onRemove={() => onChange(dropCalculation(form, index))}
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
            disabled={disabled || form.calculations.length >= SIMULATOR_LIMITS.maxCalculations}
            onClick={() =>
              onChange({ ...form, calculations: [...form.calculations, newCalculation(form)] })
            }
          >
            Agregar cálculo
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{`Resultados (1 a ${MAX_RESULTS})`}</legend>
        {errors['config.resultados'] ? (
          <p className={styles.listError}>{errors['config.resultados']}</p>
        ) : null}
        <ol className={styles.items}>
          {form.results.map((result, index) => (
            <li key={index} className={styles.item}>
              <div className={styles.grid}>
                <Select
                  label={`Cálculo del resultado ${index + 1}`}
                  value={result.calculation}
                  placeholder="Elige un cálculo"
                  options={calculationOptions}
                  disabled={disabled}
                  error={errors[`config.resultados.${index}.clave`]}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      results: replaceItem(form.results, index, {
                        ...result,
                        calculation: event.target.value,
                      }),
                    })
                  }
                />
                <TextInput
                  label={`Etiqueta del resultado ${index + 1}`}
                  required
                  value={result.label}
                  maxLength={80}
                  disabled={disabled}
                  autoComplete="off"
                  error={errors[`config.resultados.${index}.etiqueta`]}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      results: replaceItem(form.results, index, {
                        ...result,
                        label: event.target.value,
                      }),
                    })
                  }
                />
                <Select
                  label={`Formato del resultado ${index + 1}`}
                  value={result.format}
                  options={FORMAT_OPTIONS}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      results: replaceItem(form.results, index, {
                        ...result,
                        format: event.target.value as SimulatorResultFormat,
                      }),
                    })
                  }
                />
              </div>
              <ListControls
                name={`resultado ${index + 1}`}
                index={index}
                count={form.results.length}
                disabled={disabled}
                onMove={(offset) =>
                  onChange({ ...form, results: moveItem(form.results, index, offset) })
                }
                onRemove={() =>
                  onChange({
                    ...form,
                    results: removeItem(form.results, index),
                    featured: form.featured === result.calculation ? '' : form.featured,
                  })
                }
              />
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || form.results.length >= MAX_RESULTS}
            onClick={() =>
              onChange({
                ...form,
                results: [...form.results, { calculation: '', label: '', format: 'numero' }],
              })
            }
          >
            Agregar resultado
          </Button>
        </div>
        <div className={styles.grid2}>
          <Select
            label="Resultado destacado"
            value={form.featured}
            options={[{ value: '', label: 'Ninguno' }, ...resultOptions]}
            disabled={disabled}
            error={errors['config.destacado.clave']}
            onChange={(event) => onChange({ ...form, featured: event.target.value })}
          />
          {form.featured !== '' ? (
            <TextInput
              label="Subtítulo del destacado"
              required
              value={form.featuredSubtitle}
              maxLength={120}
              disabled={disabled}
              autoComplete="off"
              error={errors['config.destacado.subtitulo']}
              onChange={(event) => onChange({ ...form, featuredSubtitle: event.target.value })}
            />
          ) : null}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{`Notas (0 a ${MAX_NOTES})`}</legend>
        <ol className={styles.items}>
          {form.notes.map((note, index) => (
            <li key={index} className={styles.item}>
              <TextInput
                label={`Texto de la nota ${index + 1}`}
                required
                value={note.text}
                maxLength={300}
                disabled={disabled}
                autoComplete="off"
                error={errors[`config.notas.${index}.texto`]}
                onChange={(event) =>
                  onChange({
                    ...form,
                    notes: replaceItem(form.notes, index, { ...note, text: event.target.value }),
                  })
                }
              />
              <Select
                label={`Mostrar la nota ${index + 1} solo cuando`}
                value={note.when}
                options={[{ value: '', label: 'Siempre' }, ...calculationOptions]}
                disabled={disabled}
                error={errors[`config.notas.${index}.cuando`]}
                onChange={(event) =>
                  onChange({
                    ...form,
                    notes: replaceItem(form.notes, index, { ...note, when: event.target.value }),
                  })
                }
              />
              <ListControls
                name={`nota ${index + 1}`}
                index={index}
                count={form.notes.length}
                disabled={disabled}
                onMove={(offset) =>
                  onChange({ ...form, notes: moveItem(form.notes, index, offset) })
                }
                onRemove={() => onChange({ ...form, notes: removeItem(form.notes, index) })}
              />
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            startIcon="mas"
            disabled={disabled || form.notes.length >= MAX_NOTES}
            onClick={() => onChange({ ...form, notes: [...form.notes, { text: '', when: '' }] })}
          >
            Agregar nota
          </Button>
        </div>
      </fieldset>

      <IconPicker
        label="Icono del simulador"
        allowNone
        value={form.icon}
        error={errors['config.icono']}
        onChange={(icon) => onChange({ ...form, icon })}
      />
    </div>
  );
}

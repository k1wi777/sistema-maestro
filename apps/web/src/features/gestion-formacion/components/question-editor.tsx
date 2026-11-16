'use client';

import {
  ChallengeQuestionType,
  QUESTION_OPTIONS_LIMITS,
  QUESTION_ORDER_STEPS_LIMITS,
} from '@gns/shared';
import { useId } from 'react';

import { Button, SegmentedFilter, TextArea, TextInput } from '@/shared/ui';

import { QUESTION_TYPE_LABEL } from '../model/labels';
import {
  QUESTION_ITEM_MAX_LENGTH,
  changeQuestionType,
  type QuestionForm,
  type QuestionFormErrors,
} from '../model/question-form';
import styles from './steps/steps.module.css';

const TYPE_OPTIONS = Object.values(ChallengeQuestionType).map((type) => ({
  value: type,
  label: QUESTION_TYPE_LABEL[type],
}));

interface QuestionEditorProps {
  form: QuestionForm;
  errors: QuestionFormErrors | null;
  disabled: boolean;
  onChange: (form: QuestionForm) => void;
}

function moveStep(steps: string[], index: number, offset: -1 | 1): string[] {
  const target = index + offset;
  const next = [...steps];
  const [moved] = next.splice(index, 1);
  if (moved === undefined || target < 0 || target > steps.length - 1) {
    return steps;
  }
  next.splice(target, 0, moved);
  return next;
}

/** Formulario de una pregunta del Desafío: enunciado, lo propio de su tipo y retroalimentación. */
export function QuestionEditor({ form, errors, disabled, onChange }: QuestionEditorProps) {
  const radioName = useId();
  const set = (patch: Partial<QuestionForm>) => onChange({ ...form, ...patch });

  return (
    <>
      <SegmentedFilter
        label="Tipo de pregunta"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={(type) => onChange(changeQuestionType(form, type))}
      />
      <TextArea
        label="Pregunta"
        required
        rows={2}
        value={form.prompt}
        error={errors?.prompt}
        disabled={disabled}
        onChange={(event) => set({ prompt: event.target.value })}
      />

      {form.type === ChallengeQuestionType.MultipleChoice ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            Opciones: elige la correcta ({QUESTION_OPTIONS_LIMITS.min} a{' '}
            {QUESTION_OPTIONS_LIMITS.max})
          </legend>
          {form.options.map((option, index) => (
            <div key={index} className={styles.optionRow}>
              <label className={styles.optionRadio}>
                <input
                  type="radio"
                  name={radioName}
                  checked={option.isCorrect}
                  disabled={disabled}
                  onChange={() =>
                    set({
                      options: form.options.map((item, position) => ({
                        ...item,
                        isCorrect: position === index,
                      })),
                    })
                  }
                />
                Correcta
              </label>
              <TextInput
                label={`Opción ${index + 1}`}
                value={option.text}
                maxLength={QUESTION_ITEM_MAX_LENGTH}
                error={errors?.optionTexts[index]}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) =>
                  set({
                    options: form.options.map((item, position) =>
                      position === index ? { ...item, text: event.target.value } : item,
                    ),
                  })
                }
              />
              <Button
                context={`opción ${index + 1}`}
                variant="outline"
                size="sm"
                className={styles.optionRemove}
                disabled={disabled || form.options.length <= QUESTION_OPTIONS_LIMITS.min}
                onClick={() =>
                  set({
                    options: form.options.filter((_, position) => position !== index),
                  })
                }
              >
                Quitar
              </Button>
            </div>
          ))}
          {errors?.options ? (
            <p className={styles.error} role="alert">
              {errors.options}
            </p>
          ) : null}
          <div className={styles.row}>
            <Button
              variant="outline"
              size="sm"
              startIcon="mas"
              disabled={disabled || form.options.length >= QUESTION_OPTIONS_LIMITS.max}
              onClick={() => set({ options: [...form.options, { text: '', isCorrect: false }] })}
            >
              Agregar opción
            </Button>
          </div>
        </fieldset>
      ) : null}

      {form.type === ChallengeQuestionType.TrueFalse ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Respuesta correcta</legend>
          <div className={styles.row}>
            <label className={styles.optionRadio}>
              <input
                type="radio"
                name={radioName}
                checked={form.trueFalseAnswer}
                disabled={disabled}
                onChange={() => set({ trueFalseAnswer: true })}
              />
              Verdadero
            </label>
            <label className={styles.optionRadio}>
              <input
                type="radio"
                name={radioName}
                checked={!form.trueFalseAnswer}
                disabled={disabled}
                onChange={() => set({ trueFalseAnswer: false })}
              />
              Falso
            </label>
          </div>
        </fieldset>
      ) : null}

      {form.type === ChallengeQuestionType.Ordering ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            Pasos en el orden correcto ({QUESTION_ORDER_STEPS_LIMITS.min} a{' '}
            {QUESTION_ORDER_STEPS_LIMITS.max}); el docente los verá mezclados
          </legend>
          {form.steps.map((step, index) => (
            <div key={index} className={styles.stepRow}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}.
              </span>
              <TextInput
                label={`Paso ${index + 1}`}
                value={step}
                maxLength={QUESTION_ITEM_MAX_LENGTH}
                error={errors?.stepTexts[index]}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) =>
                  set({
                    steps: form.steps.map((item, position) =>
                      position === index ? event.target.value : item,
                    ),
                  })
                }
              />
              <div className={styles.stepActions}>
                <Button
                  context={`paso ${index + 1}`}
                  variant="outline"
                  size="sm"
                  startIcon="arriba"
                  disabled={disabled || index === 0}
                  onClick={() => set({ steps: moveStep(form.steps, index, -1) })}
                >
                  Subir
                </Button>
                <Button
                  context={`paso ${index + 1}`}
                  variant="outline"
                  size="sm"
                  startIcon="abajo"
                  disabled={disabled || index === form.steps.length - 1}
                  onClick={() => set({ steps: moveStep(form.steps, index, 1) })}
                >
                  Bajar
                </Button>
                <Button
                  context={`paso ${index + 1}`}
                  variant="outline"
                  size="sm"
                  disabled={disabled || form.steps.length <= QUESTION_ORDER_STEPS_LIMITS.min}
                  onClick={() =>
                    set({ steps: form.steps.filter((_, position) => position !== index) })
                  }
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}
          {errors?.steps ? (
            <p className={styles.error} role="alert">
              {errors.steps}
            </p>
          ) : null}
          <div className={styles.row}>
            <Button
              variant="outline"
              size="sm"
              startIcon="mas"
              disabled={disabled || form.steps.length >= QUESTION_ORDER_STEPS_LIMITS.max}
              onClick={() => set({ steps: [...form.steps, ''] })}
            >
              Agregar paso
            </Button>
          </div>
        </fieldset>
      ) : null}

      <TextArea
        label="Retroalimentación (opcional)"
        help="Se muestra al docente después de responder."
        rows={2}
        value={form.feedback}
        error={errors?.feedback}
        disabled={disabled}
        onChange={(event) => set({ feedback: event.target.value })}
      />
    </>
  );
}

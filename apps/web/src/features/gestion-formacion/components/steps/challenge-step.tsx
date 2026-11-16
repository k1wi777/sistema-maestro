'use client';

import type { ChallengeQuestion } from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Card, Notice, StatusBadge } from '@/shared/ui';

import { addQuestion, removeQuestion, replaceQuestion } from '../../api/modules';
import { QUESTION_TYPE_LABEL } from '../../model/labels';
import {
  emptyQuestionForm,
  isQuestionDirty,
  questionCountHint,
  toQuestionForm,
  validateQuestionForm,
  type QuestionForm,
  type QuestionFormErrors,
} from '../../model/question-form';
import { ModuleActionDialog } from '../module-action-dialog';
import { QuestionEditor } from '../question-editor';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

interface Item {
  /** Clave estable para React: el id de la pregunta cambia al guardar una nueva. */
  key: number;
  form: QuestionForm;
  errors: QuestionFormErrors | null;
}

function shorten(text: string): string {
  const clean = text.trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}…` : clean || 'Sin enunciado';
}

function upsert(questions: ChallengeQuestion[], saved: ChallengeQuestion): ChallengeQuestion[] {
  const exists = questions.some((question) => question.id === saved.id);
  const next = exists
    ? questions.map((question) => (question.id === saved.id ? saved : question))
    : [...questions, saved];
  return next.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Paso «Desafío GNS»: una tarjeta por pregunta. Las nuevas y las modificadas se guardan con
 * «Guardar pregunta», al cambiar de paso o con «Guardar cambios» (la API reemplaza la pregunta
 * entera); las quitadas se confirman antes de llamar a la API.
 */
export function ChallengeStep({ editor, number }: StepProps) {
  const { detail, track, updateDetail, registerSaver, setStepDirty } = editor;
  const nextKey = useRef(detail.questions.length);
  const [items, setItems] = useState<Item[]>(() =>
    detail.questions.map((question, index) => ({
      key: index,
      form: toQuestionForm(question),
      errors: null,
    })),
  );
  const [removing, setRemoving] = useState<Item | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const savedById = useMemo(
    () => new Map(detail.questions.map((question) => [question.id, toQuestionForm(question)])),
    [detail.questions],
  );
  const isDirty = useCallback(
    (item: Item) =>
      isQuestionDirty(item.form.id ? (savedById.get(item.form.id) ?? null) : null, item.form),
    [savedById],
  );
  const anyDirty = items.some(isDirty);

  const saveItem = useCallback(
    async (item: Item): Promise<boolean> => {
      const validation = validateQuestionForm(item.form);
      if (!validation.ok) {
        setItems((current) =>
          current.map((other) =>
            other.key === item.key ? { ...other, errors: validation.errors } : other,
          ),
        );
        return false;
      }
      const moduleId = detail.id;
      const result = await track(() =>
        item.form.id
          ? replaceQuestion(moduleId, item.form.id, validation.input)
          : addQuestion(moduleId, validation.input),
      );
      if (!result.ok) {
        setFailure(result.error.message);
        return false;
      }
      setFailure(null);
      updateDetail((current) => ({
        ...current,
        questions: upsert(current.questions, result.data),
      }));
      setItems((current) =>
        current.map((other) =>
          other.key === item.key
            ? { ...other, form: { ...other.form, id: result.data.id }, errors: null }
            : other,
        ),
      );
      return true;
    },
    [detail.id, track, updateDetail],
  );

  // Se declara al editor para que guarde lo pendiente al cambiar de paso o con «Guardar cambios».
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => {
    registerSaver('desafio', {
      save: async () => {
        let allSaved = true;
        for (const item of itemsRef.current) {
          const dirty = isQuestionDirty(
            item.form.id ? (savedById.get(item.form.id) ?? null) : null,
            item.form,
          );
          if (dirty && !(await saveItem(item))) {
            allSaved = false;
          }
        }
        return allSaved;
      },
    });
    return () => registerSaver('desafio', null);
  }, [registerSaver, saveItem, savedById]);
  useEffect(() => {
    setStepDirty('desafio', anyDirty);
    return () => setStepDirty('desafio', false);
  }, [anyDirty, setStepDirty]);

  function change(key: number, form: QuestionForm) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, form, errors: null } : item)),
    );
  }

  function add() {
    const key = nextKey.current;
    nextKey.current += 1;
    setItems((current) => [...current, { key, form: emptyQuestionForm(), errors: null }]);
  }

  async function saveOne(item: Item) {
    setWorking(true);
    await saveItem(item);
    setWorking(false);
  }

  async function confirmRemove() {
    if (!removing?.form.id) {
      return;
    }
    const questionId = removing.form.id;
    setWorking(true);
    const result = await track(() => removeQuestion(detail.id, questionId));
    setWorking(false);
    if (result.ok) {
      updateDetail((current) => ({
        ...current,
        questions: current.questions.filter((question) => question.id !== questionId),
      }));
      setItems((current) => current.filter((item) => item.key !== removing.key));
      setFailure(null);
    } else {
      setFailure(result.error.message);
    }
    setRemoving(null);
  }

  function discard(item: Item) {
    if (item.form.id === null) {
      setItems((current) => current.filter((other) => other.key !== item.key));
    } else {
      setRemoving(item);
    }
  }

  const hint = questionCountHint(items.length);

  return (
    <Card title="Desafío GNS" step={number}>
      <div className={styles.toolbar}>
        <p className={`${styles.hint} ${hint.tone === 'warning' ? styles.hintWarning : ''}`}>
          {hint.text}
        </p>
        <Button startIcon="mas" disabled={working} onClick={add}>
          Agregar pregunta
        </Button>
      </div>
      <p className={styles.text}>
        Preguntas de opción múltiple, verdadero o falso y ordenar pasos. El porcentaje para aprobar
        y los segundos por pregunta se configuran en «Datos del módulo».
      </p>
      {failure ? (
        <Notice tone="error" title="No se pudo completar la acción">
          {failure}
        </Notice>
      ) : null}
      {items.length === 0 ? (
        <p className={styles.text}>Este módulo todavía no tiene preguntas del Desafío.</p>
      ) : (
        <ol className={styles.items}>
          {items.map((item, index) => {
            const dirty = isDirty(item);
            return (
              <li key={item.key} className={styles.item}>
                <details open={item.form.id === null || undefined}>
                  <summary className={styles.itemSummary}>
                    <span className={styles.itemName}>
                      {`Pregunta ${index + 1} · ${shorten(item.form.prompt)}`}
                    </span>
                    <StatusBadge tone="info">{QUESTION_TYPE_LABEL[item.form.type]}</StatusBadge>
                    {dirty ? (
                      <StatusBadge tone="warning">
                        {item.form.id === null ? 'Sin guardar' : 'Cambios sin guardar'}
                      </StatusBadge>
                    ) : null}
                  </summary>
                  <div className={styles.itemBody}>
                    <QuestionEditor
                      form={item.form}
                      errors={item.errors}
                      disabled={working}
                      onChange={(form) => change(item.key, form)}
                    />
                    <div className={styles.itemActions}>
                      <Button
                        size="sm"
                        startIcon="guardar"
                        disabled={working || !dirty}
                        onClick={() => void saveOne(item)}
                      >
                        Guardar pregunta
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() => discard(item)}
                      >
                        {item.form.id === null ? 'Descartar' : 'Quitar pregunta'}
                      </Button>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      {removing ? (
        <ModuleActionDialog
          confirmation={{
            title: '¿Quitar esta pregunta?',
            description: `«${shorten(removing.form.prompt)}» deja de formar parte del Desafío de este módulo y los docentes dejan de verla. Esta acción no se puede deshacer.`,
            confirmLabel: 'Quitar pregunta',
          }}
          busy={working}
          onClose={() => setRemoving(null)}
          onConfirm={() => void confirmRemove()}
        />
      ) : null}
    </Card>
  );
}

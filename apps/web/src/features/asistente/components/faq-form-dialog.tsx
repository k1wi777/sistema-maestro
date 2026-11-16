'use client';

import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_CATEGORIES,
  FAQ_KEYWORDS_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
  FAQ_SOURCE_MAX_LENGTH,
  type FaqAdminView,
} from '@gns/shared';
import { useState, type FormEvent } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { Button, Dialog, Notice, Select, TextArea, TextInput } from '@/shared/ui';

import { createFaq, updateFaq } from '../api/faq-admin';
import { parseAnswerText, type Inline } from '../model/answer-text';
import {
  apiFaqFieldErrors,
  initialFaqForm,
  validateFaqCreate,
  validateFaqUpdate,
  type FaqFormErrors,
  type FaqFormValues,
} from '../model/faq-form';
import styles from './faq-admin.module.css';

const CATEGORY_OPTIONS = FAQ_CATEGORIES.map((category) => ({ value: category, label: category }));

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.bold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
      )}
    </>
  );
}

/** Vista previa de la respuesta tal como la verá el docente (negrita y listas; nunca HTML). */
function AnswerPreview({ text }: { text: string }) {
  const blocks = parseAnswerText(text);
  return (
    <div className={styles.preview}>
      <p className={styles.previewLabel}>Vista previa de la respuesta</p>
      {blocks.length === 0 ? (
        <p className={styles.muted}>Aquí aparecerá la respuesta que escribas.</p>
      ) : (
        blocks.map((block, index) =>
          block.kind === 'paragraph' ? (
            <p key={index} className={styles.previewText}>
              <InlineText parts={block.parts} />
            </p>
          ) : (
            <ul key={index} className={styles.previewList}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText parts={item} />
                </li>
              ))}
            </ul>
          ),
        )
      )}
    </div>
  );
}

interface FaqFormDialogProps {
  /** `null` crea una pregunta; con una pregunta, la edita. */
  faq: FaqAdminView | null;
  /** Pregunta sin respuesta que se atiende: texto precargado y vínculo al guardar. */
  fromUnanswered?: { id: string; text: string };
  onSaved: () => void;
  /** La API dijo que la pregunta sin respuesta ya se cerró (409 `pregunta_sin_respuesta_cerrada`). */
  onUnansweredClosed: (error: ApiError) => void;
  onClose: () => void;
}

/**
 * Formulario de pregunta programada: crea, edita o crea desde una pregunta sin respuesta. Se monta
 * solo mientras está abierto y conserva lo escrito cuando la API rechaza el envío.
 */
export function FaqFormDialog({
  faq,
  fromUnanswered,
  onSaved,
  onUnansweredClosed,
  onClose,
}: FaqFormDialogProps) {
  const [values, setValues] = useState<FaqFormValues>(() =>
    initialFaqForm(faq, fromUnanswered?.text),
  );
  const [errors, setErrors] = useState<FaqFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(field: keyof FaqFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    let send: (() => Promise<ApiResult<FaqAdminView>>) | null = null;
    if (faq) {
      const validation = validateFaqUpdate(values, faq);
      if (validation.ok) {
        send = () => updateFaq(faq.id, validation.input);
      } else {
        setErrors(validation.errors);
        if (validation.unchanged) {
          setFailure('No hay cambios para guardar.');
        }
      }
    } else {
      const validation = validateFaqCreate(values, fromUnanswered?.id);
      if (validation.ok) {
        send = () => createFaq(validation.input);
      } else {
        setErrors(validation.errors);
      }
    }
    if (!send) {
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await send();
    setBusy(false);
    if (result.ok) {
      onSaved();
      return;
    }
    if (result.error.code === 'pregunta_sin_respuesta_cerrada') {
      onUnansweredClosed(result.error);
      return;
    }
    const fieldErrors = apiFaqFieldErrors(
      'errors' in result.error ? result.error.errors : undefined,
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      setFailure(result.error.message);
    }
  }

  return (
    <Dialog
      open
      wide
      title={faq ? 'Editar pregunta' : 'Nueva pregunta'}
      description={
        fromUnanswered
          ? 'Escribe la respuesta a la pregunta que nadie pudo resolver. Al guardar, sale de la lista de pendientes.'
          : 'El Asistente GNS responde solo con las preguntas y respuestas programadas.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="faq-form" startIcon="guardar" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar pregunta'}
          </Button>
        </>
      }
    >
      <form
        id="faq-form"
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {failure ? (
          <Notice tone="error" title="No se pudo guardar">
            {failure}
          </Notice>
        ) : null}
        <Select
          label="Categoría"
          required
          placeholder="Selecciona una categoría"
          options={CATEGORY_OPTIONS}
          value={values.category}
          error={errors.category}
          onChange={(event) => change('category', event.target.value)}
        />
        <TextInput
          label="Pregunta"
          required
          maxLength={FAQ_QUESTION_MAX_LENGTH}
          value={values.question}
          error={errors.question}
          onChange={(event) => change('question', event.target.value)}
        />
        <TextArea
          label="Respuesta"
          required
          rows={8}
          maxLength={FAQ_ANSWER_MAX_LENGTH}
          value={values.answer}
          error={errors.answer}
          help="Usa **texto** para negrita y líneas que empiecen con - para listas."
          onChange={(event) => change('answer', event.target.value)}
        />
        <AnswerPreview text={values.answer} />
        <TextInput
          label="Palabras clave"
          maxLength={FAQ_KEYWORDS_MAX_LENGTH}
          value={values.keywords}
          error={errors.keywords}
          help="Otras formas de preguntarlo, separadas por espacio."
          onChange={(event) => change('keywords', event.target.value)}
        />
        <TextInput
          label="Fuente"
          maxLength={FAQ_SOURCE_MAX_LENGTH}
          value={values.source}
          error={errors.source}
          help="Ej. Manual de Convivencia · 3.1"
          onChange={(event) => change('source', event.target.value)}
        />
      </form>
    </Dialog>
  );
}

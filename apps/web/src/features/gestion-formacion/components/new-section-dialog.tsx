'use client';

import type { TrainingSection } from '@gns/shared';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, Notice, TextInput } from '@/shared/ui';

import { createSection } from '../api/plans';
import {
  SECTION_SUBTITLE_MAX_LENGTH,
  SECTION_TITLE_MAX_LENGTH,
  mapSectionApiErrors,
  validateNewSection,
  type NewSectionErrors,
  type NewSectionValues,
} from '../model/section-form';
import styles from './new-module-dialog.module.css';

interface NewSectionDialogProps {
  planId: string;
  /** Títulos de las secciones del plan, para no repetir ninguno. */
  existingTitles: readonly string[];
  /** Se llama con la sección creada (la pantalla recarga el plan y lleva el foco a su título). */
  onCreated: (section: TrainingSection) => void;
  onClose: () => void;
}

/**
 * Pide título y subtítulo de una sección nueva, que nace vacía y al final del plan. Se monta solo
 * mientras está abierto y conserva lo escrito cuando el título es inválido o la API rechaza el envío.
 */
export function NewSectionDialog({
  planId,
  existingTitles,
  onCreated,
  onClose,
}: NewSectionDialogProps) {
  const [values, setValues] = useState<NewSectionValues>({ title: '', subtitle: '' });
  const [errors, setErrors] = useState<NewSectionErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(field: keyof NewSectionValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const validation = validateNewSection(values, existingTitles);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await createSection(planId, validation.input);
    setBusy(false);
    if (result.ok) {
      onCreated(result.data);
      return;
    }
    const mapped = mapSectionApiErrors('errors' in result.error ? result.error.errors : undefined);
    setErrors(mapped.fields);
    setFailure(
      mapped.fields.title || mapped.fields.subtitle
        ? null
        : (mapped.other[0] ?? result.error.message),
    );
  }

  return (
    <Dialog
      open
      title="Crear nueva sección"
      description="La sección nace vacía y al final del plan. Los docentes no la ven hasta que tenga un módulo publicado."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-section-form" disabled={busy}>
            {busy ? 'Creando…' : 'Crear sección'}
          </Button>
        </>
      }
    >
      <form
        id="new-section-form"
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {failure ? (
          <Notice tone="error" title="No se pudo crear la sección">
            {failure}
          </Notice>
        ) : null}
        <TextInput
          label="Título"
          required
          value={values.title}
          error={errors.title}
          maxLength={SECTION_TITLE_MAX_LENGTH + 20}
          autoComplete="off"
          onChange={(event) => change('title', event.target.value)}
        />
        <TextInput
          label="Subtítulo"
          help="Opcional. Una frase que explique de qué trata la sección."
          value={values.subtitle}
          error={errors.subtitle}
          maxLength={SECTION_SUBTITLE_MAX_LENGTH + 20}
          autoComplete="off"
          onChange={(event) => change('subtitle', event.target.value)}
        />
      </form>
    </Dialog>
  );
}

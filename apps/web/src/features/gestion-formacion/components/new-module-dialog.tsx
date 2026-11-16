'use client';

import type { TrainingPlanTree } from '@gns/shared';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, Notice, Select, TextInput } from '@/shared/ui';

import { createModuleInPlan, type CreatedModule } from '../hooks/use-plans';
import {
  mapModuleApiErrors,
  suggestNextNumber,
  validateNewModule,
  type NewModuleErrors,
  type NewModuleValues,
} from '../model/module-form';
import type { PlanOption } from '../model/plan-catalog';
import styles from './new-module-dialog.module.css';

interface NewModuleDialogProps {
  option: PlanOption;
  tree: TrainingPlanTree | null;
  /** Se llama con el módulo creado (la pantalla abre su editor). */
  onCreated: (created: CreatedModule) => void;
  /** Se llama si falló a medio camino pero ya se creó el plan: la pantalla recarga el catálogo. */
  onPartial: () => void;
  onClose: () => void;
}

/**
 * Pide solo número, título y, en el plan General, la parte. Para un área sin plan crea antes el plan
 * y su parte única sin pedir más datos. Se monta solo mientras está abierto y conserva lo escrito
 * cuando la API rechaza el envío.
 */
export function NewModuleDialog({
  option,
  tree,
  onCreated,
  onPartial,
  onClose,
}: NewModuleDialogProps) {
  const needsSection = option.area === null;
  const sections = tree?.sections ?? [];
  const [values, setValues] = useState<NewModuleValues>(() => ({
    number: suggestNextNumber(sections.flatMap((section) => section.modules.map((m) => m.number))),
    title: '',
    sectionId: needsSection ? (sections[0]?.id ?? '') : '',
  }));
  const [errors, setErrors] = useState<NewModuleErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change<K extends keyof NewModuleValues>(field: K, value: NewModuleValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const validation = validateNewModule(values, needsSection);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await createModuleInPlan(
      option,
      tree,
      needsSection ? values.sectionId : null,
      validation.input,
    );
    setBusy(false);
    if (result.ok) {
      onCreated(result.data);
      return;
    }
    const mapped = mapModuleApiErrors('errors' in result.error ? result.error.errors : undefined);
    const fieldErrors: NewModuleErrors = {
      number: mapped.fields.number,
      title: mapped.fields.title,
    };
    setErrors(fieldErrors);
    setFailure(
      fieldErrors.number || fieldErrors.title ? null : (mapped.other[0] ?? result.error.message),
    );
    if (option.plan === null) {
      // Puede que el plan del área ya se haya creado: se relee el catálogo para reutilizarlo.
      onPartial();
    }
  }

  return (
    <Dialog
      open
      title="Nuevo módulo"
      description={
        option.plan === null
          ? `${option.area?.name ?? 'El área'} aún no tiene plan: se crea junto con este módulo. El módulo nace en borrador y no lo ve ningún docente hasta que lo publiques.`
          : 'El módulo nace en borrador y no lo ve ningún docente hasta que lo publiques.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="new-module-form" disabled={busy}>
            {busy ? 'Creando…' : 'Crear y editar'}
          </Button>
        </>
      }
    >
      <form
        id="new-module-form"
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {failure ? (
          <Notice tone="error" title="No se pudo crear el módulo">
            {failure}
          </Notice>
        ) : null}
        <TextInput
          label="Número"
          required
          value={values.number}
          error={errors.number}
          maxLength={4}
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) => change('number', event.target.value)}
        />
        <TextInput
          label="Título"
          required
          value={values.title}
          error={errors.title}
          autoComplete="off"
          onChange={(event) => change('title', event.target.value)}
        />
        {needsSection ? (
          <Select
            label="Parte del plan"
            required
            placeholder="Elige la parte"
            options={sections.map((section) => ({ value: section.id, label: section.title }))}
            value={values.sectionId}
            error={errors.sectionId}
            onChange={(event) => change('sectionId', event.target.value)}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

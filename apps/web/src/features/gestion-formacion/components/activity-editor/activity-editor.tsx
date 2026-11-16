'use client';

import { TrainingActivityType } from '@gns/shared';

import { Button, Checkbox, Notice, TextArea, TextInput } from '@/shared/ui';

import type { ActivityEditor as ActivityEditorState } from '../../hooks/use-activity-editor';
import { validateDraft, type ActivityDraft } from '../../model/activity-form';
import { ACTIVITY_TYPE_CHOICE } from '../../model/labels';
import styles from './activity-editor.module.css';
import { ActivityPreview } from './activity-preview';
import { MatchForm } from './match-form';
import { SimulatorForm } from './simulator-form';
import { TrueOrMythForm } from './true-or-myth-form';
import { WheelForm } from './wheel-form';

/** Errores que no corresponden a ningún campo visible (p. ej. una regla cruzada de la configuración). */
const SHOWN_AT_FIELD =
  /^(title|instructions|config\.(insignia|tarjetas|pares|pares_por_ronda|rondas|segundos_por_ronda|umbral_aprobacion|afirmaciones|por_partida|vidas|segundos_por_afirmacion|entradas|constantes|calculos|resultados|notas|destacado|icono))(\.|$)/;

function generalErrors(errors: Record<string, string>): string[] {
  return Object.entries(errors)
    .filter(([key]) => !SHOWN_AT_FIELD.test(key))
    .map(([, message]) => message);
}

function TypeForm({
  draft,
  errors,
  disabled,
  onChange,
}: {
  draft: ActivityDraft;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (draft: ActivityDraft) => void;
}) {
  const existing = draft.id !== null;
  switch (draft.type) {
    case TrainingActivityType.WheelPassport:
      return (
        <WheelForm
          form={draft.config}
          errors={errors}
          disabled={disabled}
          existing={existing}
          onChange={(config) => onChange({ ...draft, config })}
        />
      );
    case TrainingActivityType.Match:
      return (
        <MatchForm
          form={draft.config}
          errors={errors}
          disabled={disabled}
          existing={existing}
          onChange={(config) => onChange({ ...draft, config })}
        />
      );
    case TrainingActivityType.TrueOrMyth:
      return (
        <TrueOrMythForm
          form={draft.config}
          errors={errors}
          disabled={disabled}
          existing={existing}
          onChange={(config) => onChange({ ...draft, config })}
        />
      );
    case TrainingActivityType.Simulator:
      return (
        <SimulatorForm
          form={draft.config}
          errors={errors}
          disabled={disabled}
          existing={existing}
          onChange={(config) => onChange({ ...draft, config })}
        />
      );
  }
}

/**
 * Formulario de la actividad abierta: lo común (título, instrucciones, obligatoria al crear) y el
 * formulario de su tipo. Los números van como texto y se validan con el esquema compartido.
 */
export function ActivityEditor({ editor }: { editor: ActivityEditorState }) {
  const { session, errors, failure, saving, dirty, previewing } = editor;
  if (!session) {
    return null;
  }
  const { draft } = session;
  const typeLabel = ACTIVITY_TYPE_CHOICE[session.type].label;

  if (!draft) {
    return (
      <section className={styles.editor} aria-label={`Actividad: ${typeLabel}`}>
        <Notice tone="warning" title="Esta actividad no se puede editar aquí">
          Su configuración guardada no cumple las reglas actuales del tipo «{typeLabel}», así que no
          ofrecemos guardarla desde este formulario. Puedes quitarla del módulo o dejarla como está.
        </Notice>
        <div className={styles.actions}>
          <Button variant="outline" size="sm" onClick={editor.close}>
            Cerrar
          </Button>
        </div>
      </section>
    );
  }

  const validation = validateDraft(draft);
  const canPreview = validation.ok;
  const general = generalErrors(errors);

  return (
    <section
      className={styles.editor}
      aria-label={`${draft.id === null ? 'Nueva actividad' : 'Editar actividad'}: ${typeLabel}`}
    >
      <h4 className={styles.heading}>
        {draft.id === null ? `Nueva actividad · ${typeLabel}` : `Editar actividad · ${typeLabel}`}
      </h4>

      {draft.id !== null ? (
        <Notice tone="warning">
          Al guardar los cambios, las partidas en curso de los docentes se reinician; su progreso ya
          ganado no se borra.
        </Notice>
      ) : null}

      <div className={styles.fields}>
        <TextInput
          label="Título"
          required
          value={draft.title}
          maxLength={160}
          disabled={saving}
          autoComplete="off"
          error={errors.title}
          onChange={(event) => editor.setDraft({ ...draft, title: event.target.value })}
        />
        <TextArea
          label="Instrucciones (opcional)"
          rows={2}
          value={draft.instructions}
          maxLength={500}
          disabled={saving}
          error={errors.instructions}
          onChange={(event) => editor.setDraft({ ...draft, instructions: event.target.value })}
        />
        {draft.id === null ? (
          <Checkbox
            label="Obligatoria"
            help="Las obligatorias hacen falta para terminar el módulo; las opcionales no."
            checked={draft.isRequired}
            disabled={saving}
            onChange={(event) => editor.setDraft({ ...draft, isRequired: event.target.checked })}
          />
        ) : null}

        <TypeForm
          draft={draft}
          errors={errors}
          disabled={saving}
          onChange={(next) => editor.setDraft(next)}
        />
      </div>

      {general.length > 0 ? (
        <Notice tone="error" title="Revisa la configuración">
          {general.join(' ')}
        </Notice>
      ) : null}
      {Object.keys(errors).length > 0 && general.length === 0 ? (
        <Notice tone="error" title="No se pudo guardar la actividad">
          Revisa los campos marcados: hay datos que no se pueden guardar.
        </Notice>
      ) : null}
      {failure ? (
        <Notice tone="error" title="No se pudo guardar la actividad">
          {failure} Lo que escribiste se conserva.
        </Notice>
      ) : null}

      {previewing && validation.ok ? (
        <ActivityPreview
          activity={{ type: draft.type, title: draft.title, config: validation.update.config }}
        />
      ) : null}

      <div className={styles.actions}>
        <Button startIcon="guardar" disabled={saving || !dirty} onClick={() => void editor.save()}>
          Guardar actividad
        </Button>
        <Button variant="outline" disabled={saving || !dirty} onClick={editor.discard}>
          Descartar cambios
        </Button>
        <Button
          variant="outline"
          startIcon="ojo"
          disabled={saving || !canPreview}
          aria-pressed={previewing}
          onClick={editor.togglePreview}
        >
          {previewing ? 'Ocultar vista previa' : 'Ver vista previa'}
        </Button>
        <Button variant="outline" disabled={saving || dirty} onClick={editor.close}>
          Cerrar
        </Button>
      </div>
    </section>
  );
}

'use client';

import { RecordStatus, ReviewAction, type ObserverNote, type Review } from '@gns/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatDateTime, formatTime, todayInColombia } from '@/shared/format/dates';
import { STATUS_INFO, VoidRecordDialog, canVoid, latestDecision } from '@/shared/records';
import {
  ActionBar,
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  Notice,
  Observation,
  PageContainer,
  PageHeader,
  StatusBadge,
  type SelectOption,
} from '@/shared/ui';

import { createObserverNote } from '../api/observer-notes';
import { useGradeCatalog } from '../hooks/use-format-catalogs';
import { useNoteEditor, useObserverNote } from '../hooks/use-observer-note';
import { adjustedNoteFields } from '../model/observer-feedback';
import {
  buildCreateNote,
  buildNoteChanges,
  emptyNoteValues,
  mapNoteApiErrors,
  valuesFromNote,
  type NoteErrors,
  type NoteFormValues,
} from '../model/observer-note-form';
import { readOnlyNotice } from '../model/read-only-notice';
import { OBSERVER_LIST_PATH } from '../model/paths';
import { ObserverNoteFields, ObserverNoteReadOnly, ObserverNotices } from './observer-note-form';
import { SubmitRecordDialog } from './submit-record-dialog';
import styles from './record-screen.module.css';

const BACK_HREF = OBSERVER_LIST_PATH;
const CONFLICT_MESSAGE =
  'La anotación cambió de estado en el servidor, así que se recargó con su estado actual.';

/** Quita el error de cada campo que el docente acaba de editar. */
function withoutFields(errors: NoteErrors, patch: Partial<NoteFormValues>): NoteErrors {
  const next = { ...errors };
  for (const key of Object.keys(patch) as (keyof NoteFormValues)[]) {
    delete next[key];
  }
  return next;
}

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta anotación">
        Puede que no sea tuya o que ya no exista.{' '}
        <ButtonLink href={BACK_HREF} variant="outline" size="sm">
          Ir al observador
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

/** Comentario de la última decisión de coordinación (solo mientras sigue vigente). */
function CoordinationComment({ note, reviews }: { note: ObserverNote; reviews: Review[] }) {
  const decision = useMemo(() => latestDecision(reviews), [reviews]);
  const current =
    note.status === RecordStatus.ChangesRequested || note.status === RecordStatus.Reviewed;
  if (!decision || !current) {
    return null;
  }
  const approved = decision.decision === ReviewAction.Approved;
  const adjusted = adjustedNoteFields(decision);
  return (
    <Observation
      title={approved ? 'Revisión de coordinación' : 'Observaciones de coordinación'}
      author={decision.reviewer}
      date={formatDateTime(decision.date)}
    >
      <p className={styles.text}>
        {decision.comment ?? (approved ? 'Coordinación aprobó la anotación.' : 'Sin comentario.')}
      </p>
      {adjusted.length > 0 ? (
        <p className={styles.hint}>
          <strong>Coordinación ajustó:</strong> {adjusted.join(', ')}.
        </p>
      ) : null}
    </Observation>
  );
}

interface NoteScreenProps {
  initial: ObserverNote;
  initialReviews: Review[];
  notice: string | null;
  onConflict: () => void;
}

function NoteScreen({ initial, initialReviews, notice, onConflict }: NoteScreenProps) {
  const editor = useNoteEditor({ initial, onConflict });
  const { note, editable } = editor;
  const reviews = editor.reviews ?? initialReviews;

  const [values, setValues] = useState<NoteFormValues>(() => valuesFromNote(initial));
  const [errors, setErrors] = useState<NoteErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  const info = STATUS_INFO[note.status];
  const readOnlyMessage = readOnlyNotice(note.status, 'anotación');
  const gradeOptions = useMemo<SelectOption[]>(
    () => [{ value: note.grade.id, label: note.grade.name }],
    [note.grade],
  );

  function change(patch: Partial<NoteFormValues>) {
    setValues((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => withoutFields(previous, patch));
    setSuccess(null);
  }

  /** Guarda los cambios (si los hay). Devuelve `false` si algo lo impidió y ya se mostró el motivo. */
  async function persist(): Promise<boolean> {
    setFailure(null);
    const built = buildNoteChanges(values, note);
    if (!built.ok) {
      setErrors(built.errors);
      return false;
    }
    if (built.data === null) {
      return true;
    }
    setSaving(true);
    const outcome = await editor.save(built.data);
    setSaving(false);
    if (outcome.ok) {
      setErrors({});
      return true;
    }
    setErrors(outcome.fields);
    setFailure(outcome.message || null);
    return false;
  }

  async function handleSave() {
    if (await persist()) {
      setSuccess('Anotación guardada.');
    }
  }

  async function handleStartSubmit() {
    if (await persist()) {
      setSubmitError(null);
      setSubmitOpen(true);
    }
  }

  async function handleConfirmSubmit() {
    setSubmitBusy(true);
    setSubmitError(null);
    const outcome = await editor.submit();
    setSubmitBusy(false);
    if (outcome.ok) {
      setSubmitOpen(false);
      setSuccess('Anotación enviada a coordinación. Aquí verás su respuesta cuando la revisen.');
      window.scrollTo({ top: 0 });
      return;
    }
    setSubmitError(outcome.message);
  }

  async function handleVoid(reason: string): Promise<string | null> {
    const outcome = await editor.voidNote(reason);
    if (!outcome.ok) {
      return outcome.message;
    }
    setVoidOpen(false);
    setSuccess('Anotación anulada. Queda constancia del motivo.');
    window.scrollTo({ top: 0 });
    return null;
  }

  const title = `Anotación de ${note.studentFirstName}`;
  // En solo lectura el estado ya lo dice la insignia del encabezado: la barra no lo repite.
  const saveText = !editable
    ? null
    : editor.savedAt
      ? `Guardado · ${formatTime(editor.savedAt)}`
      : 'Guarda la anotación para conservar los cambios';

  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink href={BACK_HREF} variant="outline" size="sm" startIcon="volver">
            Observador
          </ButtonLink>
        </div>
        <PageHeader
          context="Observador del estudiante"
          title={title}
          actions={
            <div className={styles.headerBadges}>
              <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
            </div>
          }
        />

        <div className={styles.notices}>
          {notice ? <Notice tone="warning">{notice}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {readOnlyMessage ? (
            <Notice tone={readOnlyMessage.tone}>{readOnlyMessage.text}</Notice>
          ) : null}
          <CoordinationComment note={note} reviews={reviews} />
          {failure ? <Notice tone="error">{failure}</Notice> : null}
        </div>

        <div className={styles.stack}>
          <ObserverNotices type={editable ? values.type : note.type} />
          <Card>
            {editable ? (
              <ObserverNoteFields
                values={values}
                errors={errors}
                gradeOptions={gradeOptions}
                gradeLocked
                onChange={change}
              />
            ) : (
              <ObserverNoteReadOnly note={note} />
            )}
          </Card>
        </div>

        {editable || canVoid(note.status) ? (
          <ActionBar
            className={styles.actionBar}
            status={
              saveText ? (
                <span aria-live="polite" className={styles.saveStatus}>
                  {saveText}
                </span>
              ) : undefined
            }
          >
            {canVoid(note.status) ? (
              <ActionMenu
                label="Más"
                ariaLabel="Más acciones"
                icon="puntos"
                placement="up"
                collapseLabel
                items={[
                  {
                    id: 'void',
                    label: 'Anular anotación',
                    icon: 'anular',
                    onSelect: () => setVoidOpen(true),
                  },
                ]}
              />
            ) : null}
            {editable ? (
              <>
                <Button
                  variant="outline"
                  startIcon="guardar"
                  className={styles.compact}
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  Guardar anotación
                </Button>
                <Button endIcon="enviar" disabled={saving} onClick={() => void handleStartSubmit()}>
                  Enviar a coordinación
                </Button>
              </>
            ) : null}
          </ActionBar>
        ) : null}
      </div>

      {submitOpen ? (
        <SubmitRecordDialog
          title="Enviar a coordinación"
          description="Al enviarla no podrás editar la anotación mientras coordinación la revisa. Si te devuelve observaciones, podrás corregirla y reenviarla."
          busy={submitBusy}
          error={submitError}
          onClose={() => setSubmitOpen(false)}
          onConfirm={() => void handleConfirmSubmit()}
        />
      ) : null}
      {voidOpen ? (
        <VoidRecordDialog
          title="Anular anotación"
          description="La anotación queda anulada y no se puede editar; coordinación conserva la constancia."
          confirmLabel="Anular anotación"
          onClose={() => setVoidOpen(false)}
          onConfirm={handleVoid}
        />
      ) : null}
    </PageContainer>
  );
}

/** Anotación del observador (`/docente/formatos/observador/[id]`). */
export function ObserverNoteScreen({ id }: { id: string }) {
  const remote = useObserverNote(id);
  const [notice, setNotice] = useState<string | null>(null);
  const { reload } = remote;

  const handleConflict = useCallback(() => {
    setNotice(CONFLICT_MESSAGE);
    reload();
  }, [reload]);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la anotación…</Loading>
      </PageContainer>
    );
  }
  if (remote.state.status === 'error') {
    return (
      <PageContainer>
        <NotFound error={remote.state.error} onRetry={reload} />
      </PageContainer>
    );
  }
  return (
    <NoteScreen
      initial={remote.state.data.note}
      initialReviews={remote.state.data.reviews}
      notice={notice}
      onConflict={handleConflict}
    />
  );
}

function NewNoteForm({ gradeOptions }: { gradeOptions: SelectOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState<NoteFormValues>(() => emptyNoteValues(todayInColombia()));
  const [errors, setErrors] = useState<NoteErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function change(patch: Partial<NoteFormValues>) {
    setValues((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => withoutFields(previous, patch));
  }

  async function handleSave() {
    setFailure(null);
    const built = buildCreateNote(values);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setSaving(true);
    const result = await createObserverNote(built.data);
    if (!result.ok) {
      setSaving(false);
      const mapped = mapNoteApiErrors(
        result.error.statusCode === 400 ? result.error.errors : undefined,
      );
      setErrors(mapped.fields);
      setFailure(
        Object.keys(mapped.fields).length > 0 ? null : (mapped.other[0] ?? result.error.message),
      );
      return;
    }
    router.replace(`${OBSERVER_LIST_PATH}/${result.data.id}`);
  }

  return (
    <>
      <div className={styles.stack}>
        <ObserverNotices type={values.type} />
        <Card title="Datos de la anotación">
          <ObserverNoteFields
            values={values}
            errors={errors}
            gradeOptions={gradeOptions}
            gradeLocked={false}
            onChange={change}
          />
          {failure ? <Notice tone="error">{failure}</Notice> : null}
        </Card>
      </div>
      <ActionBar
        className={styles.actionBar}
        status={
          Object.keys(errors).length > 0 ? 'Revisa los campos marcados.' : 'Aún no se ha guardado'
        }
      >
        <ButtonLink href={BACK_HREF} variant="outline">
          Cancelar
        </ButtonLink>
        <Button startIcon="guardar" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Guardando…' : 'Guardar anotación'}
        </Button>
      </ActionBar>
    </>
  );
}

/** `/docente/formatos/observador/nueva`: formulario vacío; al guardar crea el borrador y abre su detalle. */
export function NewObserverNoteScreen() {
  const catalog = useGradeCatalog();
  let body;
  if (catalog.state.status === 'loading') {
    body = <Loading>Preparando el formulario…</Loading>;
  } else if (catalog.state.status === 'error') {
    body = <LoadError error={catalog.state.error} onRetry={catalog.reload} />;
  } else {
    // Un grado desactivado ya no admite anotaciones nuevas (la API también lo rechaza).
    const gradeOptions = catalog.state.data.grades
      .filter((grade) => grade.active)
      .map((grade) => ({
        value: grade.id,
        label: grade.levelName ? `${grade.name} · ${grade.levelName}` : grade.name,
      }));
    body = <NewNoteForm gradeOptions={gradeOptions} />;
  }
  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink href={BACK_HREF} variant="outline" size="sm" startIcon="volver">
            Observador
          </ButtonLink>
        </div>
        <PageHeader
          context="Observador del estudiante"
          title="Nueva anotación"
          description="Registra un reconocimiento, un avance o una situación académica o de convivencia. Queda en borrador hasta que la envíes a coordinación."
        />
        {body}
      </div>
    </PageContainer>
  );
}

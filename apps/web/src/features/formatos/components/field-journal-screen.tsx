'use client';

import type { FieldJournal, Review } from '@gns/shared';
import { useCallback, useMemo, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatTime, todayInColombia } from '@/shared/format/dates';
import { STATUS_INFO, VoidRecordDialog, canVoid, printWithTitle } from '@/shared/records';
import {
  ActionBar,
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  Dialog,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '@/shared/ui';

import { useGradeCatalog } from '../hooks/use-format-catalogs';
import { useFieldJournal, useJournalEditor } from '../hooks/use-field-journal';
import { journalFeedback, journalReviewLine } from '../model/journal-feedback';
import { journalPrintTitle } from '../model/journal-print';
import { readOnlyNotice } from '../model/read-only-notice';
import { JOURNAL_LIST_PATH } from '../model/paths';
import { JournalEntryCard } from './journal-entry-card';
import { JournalEntryForm } from './journal-entry-form';
import { JournalHeader } from './journal-header';
import { JournalPrint } from './journal-print';
import { JournalReview } from './journal-review';
import { SubmitRecordDialog } from './submit-record-dialog';
import journal from './journal.module.css';
import styles from './record-screen.module.css';

const CONFLICT_MESSAGE =
  'La hoja cambió de estado en el servidor, así que se recargó con su estado actual.';

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos esta hoja">
        Puede que no sea tuya o que ya no exista.{' '}
        <ButtonLink href={JOURNAL_LIST_PATH} variant="outline" size="sm">
          Ir a Mis diarios
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

interface JournalScreenProps {
  initial: FieldJournal;
  initialReviews: Review[];
  notice: string | null;
  onConflict: () => void;
}

function JournalScreen({ initial, initialReviews, notice, onConflict }: JournalScreenProps) {
  const editor = useJournalEditor({ initial, onConflict });
  const { journal: sheet, editable } = editor;
  const catalog = useGradeCatalog();
  const reviews = editor.reviews ?? initialReviews;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const levelName = useMemo(() => {
    if (catalog.state.status !== 'ready') {
      return null;
    }
    return (
      catalog.state.data.grades.find((grade) => grade.id === sheet.grade.id)?.levelName ?? null
    );
  }, [catalog.state, sheet.grade.id]);

  const feedback = useMemo(() => journalFeedback(reviews), [reviews]);
  const line = useMemo(() => journalReviewLine(sheet.status, feedback), [sheet.status, feedback]);
  const adjusted = useMemo(() => new Set(feedback.adjustedEntryIds), [feedback]);

  const info = STATUS_INFO[sheet.status];
  const readOnlyMessage = readOnlyNotice(sheet.status, 'hoja');
  const title = `${sheet.grade.name} · Periodo ${sheet.period.number}`;
  const today = todayInColombia();

  const startSubmit = useCallback(() => {
    if (sheet.entries.length === 0) {
      setBlocked('Agrega al menos un registro antes de enviar la hoja a coordinación.');
      return;
    }
    setBlocked(null);
    setSubmitError(null);
    setSubmitOpen(true);
  }, [sheet.entries.length]);

  async function handleConfirmSubmit() {
    setSubmitBusy(true);
    setSubmitError(null);
    const outcome = await editor.submit();
    setSubmitBusy(false);
    if (outcome.ok) {
      setSubmitOpen(false);
      setEditingId(null);
      setSuccess('Hoja enviada a coordinación. Aquí verás su respuesta cuando la revisen.');
      window.scrollTo({ top: 0 });
      return;
    }
    setSubmitError(outcome.message);
  }

  async function handleVoid(reason: string): Promise<string | null> {
    const outcome = await editor.voidJournal(reason);
    if (!outcome.ok) {
      return outcome.message;
    }
    setVoidOpen(false);
    setEditingId(null);
    setSuccess('Hoja anulada. Queda constancia del motivo.');
    window.scrollTo({ top: 0 });
    return null;
  }

  async function handleConfirmRemove() {
    if (!removing) {
      return;
    }
    setRemoveBusy(true);
    setRemoveError(null);
    const outcome = await editor.removeEntry(removing);
    setRemoveBusy(false);
    if (outcome.ok) {
      setRemoving(null);
      return;
    }
    setRemoveError(outcome.message);
  }

  // En solo lectura el estado ya lo dice la insignia del encabezado: la barra no lo repite.
  const saveText = !editable
    ? null
    : editor.savedAt
      ? `Guardado · ${formatTime(editor.savedAt)}`
      : 'Cada registro se guarda al agregarlo';

  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink href={JOURNAL_LIST_PATH} variant="outline" size="sm" startIcon="volver">
            Mis diarios
          </ButtonLink>
        </div>
        <PageHeader
          context="Diario de campo"
          title={title}
          actions={
            <div className={styles.headerBadges}>
              <span className={styles.code}>Código F-PA-05 · Versión 2</span>
              <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
            </div>
          }
        />

        <div className={styles.notices}>
          {notice ? <Notice tone="warning">{notice}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {blocked ? <Notice tone="error">{blocked}</Notice> : null}
          {readOnlyMessage ? (
            <Notice tone={readOnlyMessage.tone}>{readOnlyMessage.text}</Notice>
          ) : null}
        </div>

        <div className={styles.stack}>
          <JournalHeader journal={sheet} levelName={levelName} />

          <Card title="Registro de eventos" step={2}>
            <p className={journal.note}>
              La descripción del evento debe incluir al estudiante implicado (solo nombre de pila).
              Si registras un aspecto por mejorar, define las acciones. No registres documentos de
              identidad, datos de salud, diagnósticos ni fotos de los niños.
            </p>
            {editable ? (
              <div className={journal.newEntry}>
                <h3 className={journal.newEntryTitle}>Nuevo registro</h3>
                <JournalEntryForm
                  today={today}
                  onCreate={(body) => editor.addEntry(body)}
                  onUpdate={(entryId, changes) => editor.updateEntry(entryId, changes)}
                />
              </div>
            ) : null}
            {sheet.entries.length === 0 ? (
              <p className={journal.empty}>Aún no hay registros en esta hoja.</p>
            ) : (
              <ul className={journal.entries}>
                {sheet.entries.map((entry) => (
                  <li key={entry.id}>
                    {editable && editingId === entry.id ? (
                      <div className={journal.newEntry}>
                        <h3 className={journal.newEntryTitle}>Editar registro</h3>
                        <JournalEntryForm
                          entry={entry}
                          today={today}
                          onCreate={(body) => editor.addEntry(body)}
                          onUpdate={(entryId, changes) => editor.updateEntry(entryId, changes)}
                          onDone={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <JournalEntryCard
                        entry={entry}
                        adjusted={adjusted.has(entry.id)}
                        onEdit={editable ? () => setEditingId(entry.id) : undefined}
                        onRemove={
                          editable
                            ? () => {
                                setRemoveError(null);
                                setRemoving(entry.id);
                              }
                            : undefined
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <JournalReview line={line} feedback={feedback} />
        </div>

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
          {canVoid(sheet.status) ? (
            <ActionMenu
              label="Más"
              ariaLabel="Más acciones"
              icon="puntos"
              placement="up"
              collapseLabel
              items={[
                {
                  id: 'void',
                  label: 'Anular hoja',
                  icon: 'anular',
                  onSelect: () => setVoidOpen(true),
                },
              ]}
            />
          ) : null}
          <Button
            variant="secondary"
            startIcon="documento"
            className={styles.compact}
            onClick={() => printWithTitle(journalPrintTitle(sheet))}
          >
            Exportar PDF
          </Button>
          {editable ? (
            <Button endIcon="enviar" onClick={startSubmit}>
              Enviar a coordinación
            </Button>
          ) : null}
        </ActionBar>
      </div>

      <JournalPrint journal={sheet} levelName={levelName} line={line} feedback={feedback} />

      {submitOpen ? (
        <SubmitRecordDialog
          title="Enviar a coordinación"
          description="Al enviarla no podrás editar la hoja mientras coordinación la revisa. Si te devuelve observaciones, podrás corregirla y reenviarla."
          busy={submitBusy}
          error={submitError}
          onClose={() => setSubmitOpen(false)}
          onConfirm={() => void handleConfirmSubmit()}
        />
      ) : null}
      {voidOpen ? (
        <VoidRecordDialog
          title="Anular hoja"
          description="La hoja queda anulada y no se puede editar; coordinación conserva la constancia."
          confirmLabel="Anular hoja"
          onClose={() => setVoidOpen(false)}
          onConfirm={handleVoid}
        />
      ) : null}
      {removing ? (
        <Dialog
          open
          title="Quitar registro"
          description="El registro se quita de la hoja. Queda constancia del antes y el después en la bitácora."
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button variant="outline" disabled={removeBusy} onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={removeBusy}
                onClick={() => void handleConfirmRemove()}
              >
                {removeBusy ? 'Quitando…' : 'Quitar registro'}
              </Button>
            </>
          }
        >
          {removeError ? <Notice tone="error">{removeError}</Notice> : null}
        </Dialog>
      ) : null}
    </PageContainer>
  );
}

/** Hoja del diario de campo (`/docente/formatos/diario/[id]`). */
export function FieldJournalScreen({ id }: { id: string }) {
  const remote = useFieldJournal(id);
  const [notice, setNotice] = useState<string | null>(null);
  const { reload } = remote;

  const handleConflict = useCallback(() => {
    setNotice(CONFLICT_MESSAGE);
    reload();
  }, [reload]);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando la hoja…</Loading>
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
    <JournalScreen
      initial={remote.state.data.journal}
      initialReviews={remote.state.data.reviews}
      notice={notice}
      onConflict={handleConflict}
    />
  );
}

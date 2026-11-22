'use client';

import {
  AnnotationStatus,
  ContributionStatus,
  JournalStatus,
  type FieldJournalDay,
  type JournalAnnotation,
} from '@gns/shared';
import { useCallback, useMemo, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading } from '@/shared/data';
import { formatDateTime, formatTime, formatWeekdayDate } from '@/shared/format/dates';
import {
  DiscardDraftDialog,
  JOURNAL_STATUS_INFO,
  VoidRecordDialog,
  printWithTitle,
} from '@/shared/records';
import {
  ActionBar,
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  DataTable,
  Notice,
  Observation,
  PageContainer,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
} from '@/shared/ui';

import { useJournalDay, useJournalEditor, type JournalOutcome } from '../hooks/use-field-journal';
import { contributionSummary, journalPrintTitle, readOnlyMessage } from '../model/journal-text';
import { JOURNAL_LIST_PATH } from '../model/paths';
import { AnnotationCard } from './annotation-card';
import { AnnotationForm } from './annotation-form';
import { JournalPrint } from './journal-print';
import { SubmitJournalDialog } from './submit-journal-dialog';
import journal from './journal.module.css';
import styles from './record-screen.module.css';

const CONFLICT_MESSAGE =
  'El diario cambió de estado en el servidor, así que se recargó con su estado actual.';

function NotFound({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === 403 || error.statusCode === 404) {
    return (
      <Notice tone="warning" title="No encontramos este diario">
        Solo ven el diario de un grupo los docentes que le dan clase y su director(a) de grupo.{' '}
        <ButtonLink href={JOURNAL_LIST_PATH} variant="outline" size="sm">
          Ir a Diario de campo
        </ButtonLink>
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

const CONTRIBUTION_TEXT: Record<
  string,
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  [ContributionStatus.Ready]: { label: 'Lista', tone: 'success' },
  [ContributionStatus.Draft]: { label: 'En borrador', tone: 'warning' },
  [ContributionStatus.None]: { label: 'Sin aporte', tone: 'neutral' },
};

type Contributor = FieldJournalDay['contributors'][number];

const CONTRIBUTOR_COLUMNS: DataTableColumn<Contributor>[] = [
  { key: 'teacher', header: 'Docente', render: (entry) => entry.teacher.fullName },
  {
    key: 'areas',
    header: 'Asignatura',
    render: (entry) => entry.areas.map((area) => area.name).join(', ') || '—',
  },
  {
    key: 'status',
    header: 'Estado',
    render: (entry) => {
      const text = CONTRIBUTION_TEXT[entry.status] ?? CONTRIBUTION_TEXT[ContributionStatus.None]!;
      return <StatusBadge tone={text.tone}>{text.label}</StatusBadge>;
    },
  },
  {
    key: 'time',
    header: 'Hora',
    render: (entry) => (entry.readyAt ? formatTime(entry.readyAt) : '—'),
  },
];

interface DayScreenProps {
  initial: FieldJournalDay;
  groupId: string;
  date: string;
  notice: string | null;
  onConflict: () => void;
}

function DayScreen({ initial, groupId, date, notice, onConflict }: DayScreenProps) {
  const editor = useJournalEditor({ initial, onConflict });
  const { journal: day, savedAt } = editor;
  const { viewer } = day;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [discarding, setDiscarding] = useState<JournalAnnotation | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const mine = useMemo(() => day.annotations.filter((entry) => entry.isMine), [day.annotations]);
  const others = useMemo(() => day.annotations.filter((entry) => !entry.isMine), [day.annotations]);
  const status = day.status;
  const info = status ? JOURNAL_STATUS_INFO[status] : JOURNAL_STATUS_INFO[JournalStatus.InProgress];
  const readOnly = readOnlyMessage(status);
  const resubmit = status === JournalStatus.ChangesRequested;
  const canEditAnnotation = (annotation: JournalAnnotation): boolean =>
    status === JournalStatus.ChangesRequested
      ? annotation.status === AnnotationStatus.Observed
      : status === null || status === JournalStatus.InProgress;

  const handleSubmit = useCallback(async () => {
    setSubmitBusy(true);
    setSubmitError(null);
    const outcome = await editor.submit(resubmit);
    setSubmitBusy(false);
    if (outcome.ok) {
      setSubmitOpen(false);
      setEditingId(null);
      setSuccess('Diario enviado a coordinación. Aquí verás su respuesta cuando lo revisen.');
      window.scrollTo({ top: 0 });
      return;
    }
    setSubmitError(outcome.message);
  }, [editor, resubmit]);

  async function handleVoid(reason: string): Promise<string | null> {
    const outcome = await editor.voidJournal(reason);
    if (!outcome.ok) {
      return outcome.message;
    }
    setVoidOpen(false);
    setSuccess('Diario anulado. Queda constancia del motivo.');
    window.scrollTo({ top: 0 });
    return null;
  }

  async function rowAction(task: () => Promise<JournalOutcome>) {
    setRowError(null);
    const outcome = await task();
    if (!outcome.ok) {
      setRowError(outcome.message);
    }
  }

  const saveText = readOnly
    ? null
    : savedAt
      ? `Guardado · ${formatTime(savedAt)}`
      : 'Tus borradores solo los ves tú';

  /** Solo un borrador propio de un diario que nunca se envió (misma regla que la API). */
  const canDiscardAnnotation = (annotation: JournalAnnotation): boolean =>
    annotation.isMine &&
    annotation.status === AnnotationStatus.Draft &&
    status === JournalStatus.InProgress;

  async function handleDiscard(): Promise<string | null> {
    if (!discarding) {
      return null;
    }
    const outcome = await editor.discard(discarding.id);
    if (!outcome.ok) {
      return outcome.message;
    }
    setDiscarding(null);
    setEditingId(null);
    setSuccess('Borrador descartado.');
    window.scrollTo({ top: 0 });
    return null;
  }

  const annotationActions = (annotation: JournalAnnotation) => {
    if (!annotation.isMine || !canEditAnnotation(annotation)) {
      return undefined;
    }
    return (
      <>
        {canDiscardAnnotation(annotation) ? (
          <Button
            variant="outline"
            size="sm"
            startIcon="papelera"
            context={`anotación de ${annotation.area.name}`}
            onClick={() => setDiscarding(annotation)}
          >
            Descartar borrador
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          startIcon="lapiz"
          context={`anotación de ${annotation.area.name}`}
          onClick={() => setEditingId(annotation.id)}
        >
          Editar
        </Button>
        {annotation.status !== AnnotationStatus.Ready ? (
          <Button
            size="sm"
            startIcon="check"
            context={`anotación de ${annotation.area.name}`}
            onClick={() => void rowAction(() => editor.markReady(annotation.id))}
          >
            Marcar como lista
          </Button>
        ) : null}
        {annotation.status === AnnotationStatus.Ready &&
        status !== JournalStatus.ChangesRequested ? (
          <Button
            variant="outline"
            size="sm"
            context={`anotación de ${annotation.area.name}`}
            onClick={() => void rowAction(() => editor.markDraft(annotation.id))}
          >
            Volver a borrador
          </Button>
        ) : null}
      </>
    );
  };

  const renderMine = (annotation: JournalAnnotation) =>
    editingId === annotation.id ? (
      <div className={journal.newEntry}>
        <h3 className={journal.newEntryTitle}>Editar anotación</h3>
        <AnnotationForm
          groupId={groupId}
          date={date}
          areas={viewer.areas}
          annotation={annotation}
          onCreate={editor.create}
          onUpdate={editor.update}
          onReady={editor.markReady}
          onDone={() => setEditingId(null)}
        />
      </div>
    ) : (
      <AnnotationCard annotation={annotation} actions={annotationActions(annotation)} />
    );

  return (
    <PageContainer>
      <div className={styles.screen}>
        <div className={styles.back}>
          <ButtonLink href={JOURNAL_LIST_PATH} variant="outline" size="sm" startIcon="volver">
            Diario de campo
          </ButtonLink>
        </div>
        <PageHeader
          context="Diario de campo"
          title={`${day.group.name} · ${formatWeekdayDate(day.date)}`}
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
          {readOnly ? <Notice tone={readOnly.tone}>{readOnly.text}</Notice> : null}
          {viewer.blockedReason ? <Notice tone="warning">{viewer.blockedReason}</Notice> : null}
          {rowError ? <Notice tone="error">{rowError}</Notice> : null}
        </div>

        <div className={styles.stack}>
          <Card title="Encabezado del formato" step={1}>
            <dl className={styles.facts}>
              <div>
                <dt>Año lectivo</dt>
                <dd>{day.schoolYear}</dd>
              </div>
              <div>
                <dt>Nivel</dt>
                <dd>{day.level.name}</dd>
              </div>
              <div>
                <dt>Grado</dt>
                <dd>{day.grade.name}</dd>
              </div>
              <div>
                <dt>Grupo</dt>
                <dd>{day.group.name}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatWeekdayDate(day.date)}</dd>
              </div>
              <div>
                <dt>Director(a) de grupo</dt>
                <dd>
                  {day.homeroomTeacher
                    ? `${day.homeroomTeacher.fullName}${viewer.isHomeroomTeacher ? ' (tú)' : ''}`
                    : 'Sin director(a) asignado'}
                </dd>
              </div>
            </dl>
          </Card>

          {viewer.isHomeroomTeacher ? (
            <Card title="Aportes del grupo" step={2}>
              <p className={journal.note}>
                {contributionSummary(day.readyCount, day.expectedCount)}
              </p>
              <DataTable
                embedded
                caption={`Aportes de los docentes de ${day.group.name}`}
                showCaption
                columns={CONTRIBUTOR_COLUMNS}
                rows={day.contributors}
                getRowKey={(entry) => entry.teacher.id}
              />
            </Card>
          ) : null}

          {viewer.isParticipant ? (
            <Card title="Mi anotación" step={viewer.isHomeroomTeacher ? 3 : 2}>
              <p className={journal.note}>
                Tus borradores solo los ves tú. Los demás docentes y el director(a) ven tu anotación
                cuando la marcas como lista. La descripción debe incluir al estudiante implicado
                (solo nombre de pila).
                {mine.some(canDiscardAnnotation)
                  ? ' Solo puedes descartar una anotación en borrador de un diario que aún no se ha enviado.'
                  : ''}
              </p>
              {mine.length > 0 ? (
                <ul className={journal.entries}>
                  {mine.map((annotation) => (
                    <li key={annotation.id}>{renderMine(annotation)}</li>
                  ))}
                </ul>
              ) : null}
              {viewer.canAnnotate && (mine.length === 0 || adding) ? (
                <div className={journal.newEntry}>
                  <h3 className={journal.newEntryTitle}>
                    {mine.length === 0 ? 'Nueva anotación' : 'Otra anotación'}
                  </h3>
                  <AnnotationForm
                    key={`new-${mine.length}`}
                    groupId={groupId}
                    date={date}
                    areas={viewer.areas}
                    onCreate={async (body) => {
                      const outcome = await editor.create(body);
                      if (outcome.ok) {
                        setAdding(false);
                      }
                      return outcome;
                    }}
                    onUpdate={editor.update}
                    onReady={editor.markReady}
                  />
                </div>
              ) : null}
              {viewer.canAnnotate && mine.length > 0 && !adding ? (
                <div className={journal.newEntry}>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon="mas"
                    onClick={() => setAdding(true)}
                  >
                    Agregar otra anotación
                  </Button>
                </div>
              ) : null}
              {mine.length === 0 && !viewer.canAnnotate ? (
                <p className={journal.empty}>No agregaste anotaciones a este diario.</p>
              ) : null}
            </Card>
          ) : null}

          <Card
            title={viewer.isParticipant ? 'Anotaciones de los demás docentes' : 'Anotaciones'}
            step={(viewer.isHomeroomTeacher ? 3 : 2) + (viewer.isParticipant ? 1 : 0)}
            actions={<span className={journal.note}>Solo lectura</span>}
          >
            {others.length === 0 ? (
              <p className={journal.empty}>
                Aún no hay anotaciones listas de otros docentes en este diario.
              </p>
            ) : (
              <ul className={journal.entries}>
                {others.map((annotation) => (
                  <li key={annotation.id}>
                    <AnnotationCard annotation={annotation} showTeacher />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Revisión"
            step={(viewer.isHomeroomTeacher ? 3 : 2) + (viewer.isParticipant ? 2 : 1)}
          >
            <div className={journal.review}>
              {day.signature ? (
                <p className={journal.signature}>
                  Revisado por:{' '}
                  <strong>{`${day.signature.reviewer.fullName}, ${formatDateTime(day.signature.date)}`}</strong>
                </p>
              ) : (
                <p className={journal.signature}>
                  Revisado por: <strong>Pendiente de revisión por coordinación</strong>
                </p>
              )}
              {day.generalObservation ? (
                <Observation
                  title="Observación general"
                  author={day.generalObservation.reviewer.fullName}
                  date={formatDateTime(day.generalObservation.date)}
                >
                  {day.generalObservation.text}
                </Observation>
              ) : null}
            </div>
          </Card>
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
          {viewer.canVoid ? (
            <ActionMenu
              label="Más"
              ariaLabel="Más acciones"
              icon="puntos"
              placement="up"
              collapseLabel
              items={[
                {
                  id: 'void',
                  label: 'Anular diario',
                  icon: 'anular',
                  onSelect: () => setVoidOpen(true),
                },
              ]}
            />
          ) : null}
          {viewer.isHomeroomTeacher ? (
            <Button
              variant="secondary"
              startIcon="documento"
              className={styles.compact}
              onClick={() => printWithTitle(journalPrintTitle(day))}
            >
              Exportar PDF
            </Button>
          ) : null}
          {viewer.isHomeroomTeacher && (status === JournalStatus.InProgress || resubmit) ? (
            <Button
              endIcon="enviar"
              disabled={!(viewer.canSubmit || viewer.canResubmit)}
              onClick={() => {
                setSubmitError(null);
                setSubmitOpen(true);
              }}
            >
              {resubmit ? 'Reenviar a coordinación' : 'Enviar a coordinación'}
            </Button>
          ) : null}
        </ActionBar>
      </div>

      <JournalPrint journal={day} />

      {submitOpen ? (
        <SubmitJournalDialog
          journal={day}
          resubmit={resubmit}
          busy={submitBusy}
          error={submitError}
          onClose={() => setSubmitOpen(false)}
          onConfirm={() => void handleSubmit()}
        />
      ) : null}
      {discarding ? (
        <DiscardDraftDialog
          description={`Se borrará tu anotación en borrador de ${discarding.area.name} y no podrás recuperarla. Nadie más la ha visto.`}
          onClose={() => setDiscarding(null)}
          onConfirm={handleDiscard}
        />
      ) : null}
      {voidOpen ? (
        <VoidRecordDialog
          title="Anular diario"
          description="El diario queda anulado y no se puede editar; coordinación conserva la constancia."
          confirmLabel="Anular diario"
          onClose={() => setVoidOpen(false)}
          onConfirm={handleVoid}
        />
      ) : null}
    </PageContainer>
  );
}

/** Diario de un grupo en una fecha (`/docente/formatos/diario/[groupId]/[date]`). */
export function JournalDayScreen({ groupId, date }: { groupId: string; date: string }) {
  const remote = useJournalDay(groupId, date);
  const [notice, setNotice] = useState<string | null>(null);
  const { reload } = remote;

  const handleConflict = useCallback(() => {
    setNotice(CONFLICT_MESSAGE);
    reload();
  }, [reload]);

  if (remote.state.status === 'loading') {
    return (
      <PageContainer>
        <Loading>Cargando el diario…</Loading>
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
    <DayScreen
      key={`${remote.state.data.id ?? 'new'}:${remote.state.data.status ?? ''}:${remote.state.data.updatedAt?.toISOString() ?? ''}`}
      initial={remote.state.data}
      groupId={groupId}
      date={date}
      notice={notice}
      onConflict={handleConflict}
    />
  );
}

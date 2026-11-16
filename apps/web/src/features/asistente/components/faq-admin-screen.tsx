'use client';

import {
  ApiErrorCode,
  FAQ_CATEGORIES,
  type FaqAdminView,
  type UnansweredQuestion,
} from '@gns/shared';
import { useMemo, useState } from 'react';

import { LoadError, Loading } from '@/shared/data';
import { formatDateTime } from '@/shared/format/dates';
import {
  Button,
  Card,
  Notice,
  PageContainer,
  PageHeader,
  SegmentedFilter,
  Select,
  StatusBadge,
} from '@/shared/ui';

import { updateFaq } from '../api/faq-admin';
import { useAdminFaqs, usePendingQuestions } from '../hooks/use-faq-admin';
import {
  excerpt,
  groupAdminFaqs,
  latestOccurrence,
  type FaqAdminFilters,
  type FaqStatusFilter,
} from '../model/faq-admin';
import styles from './faq-admin.module.css';
import { FaqFormDialog } from './faq-form-dialog';

const CATEGORY_OPTIONS = FAQ_CATEGORIES.map((category) => ({ value: category, label: category }));
const STATUS_OPTIONS: { value: FaqStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
];

type Editing = { faq: FaqAdminView | null; from?: { id: string; text: string } } | null;

interface PageNotice {
  tone: 'warning' | 'error' | 'success';
  title: string;
  text: string;
}

/** Gestión del asistente: preguntas programadas (sin borrado) y preguntas sin respuesta. */
export function FaqAdminScreen() {
  const faqs = useAdminFaqs();
  const pending = usePendingQuestions();
  const [filters, setFilters] = useState<FaqAdminFilters>({ category: '', status: 'all' });
  const [editing, setEditing] = useState<Editing>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);

  const groups = useMemo(
    () => (faqs.state.status === 'ready' ? groupAdminFaqs(faqs.state.data, filters) : []),
    [faqs.state, filters],
  );

  async function toggle(faq: FaqAdminView) {
    setTogglingId(faq.id);
    setNotice(null);
    const result = await updateFaq(faq.id, { isActive: !faq.isActive });
    setTogglingId(null);
    if (result.ok) {
      await faqs.refresh();
    } else {
      setNotice({
        tone: 'error',
        title: 'No se pudo cambiar el estado',
        text: result.error.message,
      });
    }
  }

  function saved() {
    const closed = editing;
    setEditing(null);
    setNotice({
      tone: 'success',
      title: 'Pregunta guardada',
      text: closed?.from
        ? 'La respuesta quedó programada y la pregunta salió de la lista de pendientes.'
        : closed?.faq
          ? 'Los cambios quedaron guardados.'
          : 'La pregunta quedó programada.',
    });
    void faqs.refresh();
    void pending.refresh();
  }

  function unansweredClosed(error: { code: string; message: string }) {
    setEditing(null);
    setNotice({
      tone: 'warning',
      title:
        error.code === ApiErrorCode.UnansweredQuestionClosed
          ? 'Esa pregunta ya no está pendiente'
          : 'Pregunta cerrada',
      text: `${error.message} Actualizamos la lista.`,
    });
    void faqs.refresh();
    void pending.refresh();
  }

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Asistente"
        description="Preguntas programadas que responde el Asistente GNS y preguntas que quedaron sin respuesta."
        actions={
          <Button startIcon="mas" onClick={() => setEditing({ faq: null })}>
            Nueva pregunta
          </Button>
        }
      />
      <div className={styles.root}>
        {notice ? (
          <Notice tone={notice.tone} title={notice.title}>
            {notice.text}
          </Notice>
        ) : null}

        <Card title="Preguntas programadas del asistente">
          <div className={styles.body}>
            <p className={styles.muted}>
              El Asistente GNS responde solo con estas preguntas y respuestas. Una pregunta
              desactivada deja de aparecer para los docentes, pero se conserva.
            </p>
            <div className={styles.filters}>
              <Select
                label="Categoría"
                placeholder="Todas las categorías"
                options={CATEGORY_OPTIONS}
                value={filters.category}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, category: event.target.value }))
                }
              />
              <div className={styles.segmented}>
                <span className={styles.filterLabel}>Estado</span>
                <SegmentedFilter
                  label="Estado de las preguntas"
                  options={STATUS_OPTIONS}
                  value={filters.status}
                  onChange={(status) => setFilters((current) => ({ ...current, status }))}
                />
              </div>
            </div>
            {faqs.state.status === 'loading' ? <Loading>Cargando las preguntas…</Loading> : null}
            {faqs.state.status === 'error' ? (
              <LoadError
                error={faqs.state.error}
                title="No pudimos cargar las preguntas"
                onRetry={faqs.reload}
              />
            ) : null}
            {faqs.state.status === 'ready' ? (
              groups.length === 0 ? (
                <p className={styles.empty}>
                  {faqs.state.data.length === 0
                    ? 'Aún no hay preguntas programadas.'
                    : 'Ninguna pregunta cumple estos filtros.'}
                </p>
              ) : (
                groups.map((group) => (
                  <section key={group.category} aria-label={group.category}>
                    <h3 className={styles.group}>{group.category}</h3>
                    <ul className={styles.rows}>
                      {group.faqs.map((faq) => (
                        <li key={faq.id} className={styles.row}>
                          <div className={styles.info}>
                            <strong>{faq.question}</strong>
                            <span className={styles.muted}>{excerpt(faq.answer, 160)}</span>
                          </div>
                          <StatusBadge tone={faq.isActive ? 'success' : 'neutral'}>
                            {faq.isActive ? 'Activa' : 'Inactiva'}
                          </StatusBadge>
                          <div className={styles.actions}>
                            <Button variant="outline" size="sm" onClick={() => setEditing({ faq })}>
                              Editar
                              <span className="sr-only">{`: ${faq.question}`}</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={togglingId === faq.id}
                              onClick={() => void toggle(faq)}
                            >
                              {faq.isActive ? 'Desactivar' : 'Activar'}
                              <span className="sr-only">{`: ${faq.question}`}</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )
            ) : null}
            {faqs.state.status === 'ready' ? (
              <p className={styles.muted} role="status">
                {faqs.state.data.length === 1
                  ? '1 pregunta programada.'
                  : `${faqs.state.data.length} preguntas programadas.`}
              </p>
            ) : null}
          </div>
        </Card>

        <Card title="Preguntas sin respuesta">
          <div className={styles.body}>
            {pending.state.status === 'loading' ? (
              <Loading>Cargando las preguntas sin respuesta…</Loading>
            ) : null}
            {pending.state.status === 'error' ? (
              <LoadError
                error={pending.state.error}
                title="No pudimos cargar las preguntas sin respuesta"
                onRetry={pending.reload}
              />
            ) : null}
            {pending.state.status === 'ready' ? (
              pending.state.data.length === 0 ? (
                <p className={styles.empty}>No hay preguntas sin respuesta pendientes.</p>
              ) : (
                <ul className={styles.rows}>
                  {pending.state.data.map((question) => (
                    <PendingRow
                      key={question.id}
                      question={question}
                      onCreate={(from) => setEditing({ faq: null, from })}
                    />
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </Card>
      </div>
      {editing ? (
        <FaqFormDialog
          key={editing.faq?.id ?? editing.from?.id ?? 'new'}
          faq={editing.faq}
          fromUnanswered={editing.from}
          onSaved={saved}
          onUnansweredClosed={unansweredClosed}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </PageContainer>
  );
}

function PendingRow({
  question,
  onCreate,
}: {
  question: UnansweredQuestion;
  onCreate: (from: { id: string; text: string }) => void;
}) {
  const text = question.text;
  if (text === null) {
    return null;
  }
  const latest = latestOccurrence(question);
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <strong>{text}</strong>
        <span className={styles.muted}>
          {[
            question.times === 1 ? '1 vez' : `${question.times} veces`,
            `última ${formatDateTime(question.lastAskedAt)}`,
            latest ? latest.user.name : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => onCreate({ id: question.id, text })}>
          Crear respuesta
          <span className="sr-only">{`: ${text}`}</span>
        </Button>
      </div>
    </li>
  );
}

'use client';

import type { FieldJournalSummary } from '@gns/shared';
import { useState } from 'react';

import { usePagedList, useQueryParams } from '@/shared/data';
import { formatShortDate } from '@/shared/format/dates';
import { STATUS_INFO } from '@/shared/records';
import { useSession } from '@/shared/session';
import { Button, ButtonLink, RecordCard, StatusBadge } from '@/shared/ui';

import { listFieldJournals } from '../api/field-journals';
import { NewJournalDialog } from './new-journal-dialog';
import { RecordListView, statusFromUrl } from './record-list-view';
import styles from './formats-list.module.css';

const PAGE_SIZE = 20;

function JournalCard({ journal }: { journal: FieldJournalSummary }) {
  const info = STATUS_INFO[journal.status];
  const title = `${journal.grade.name} · Periodo ${journal.period.number}`;
  return (
    <RecordCard
      title={journal.grade.name}
      headingLevel={2}
      tone={info.tone}
      status={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      meta={[
        `${journal.period.schoolYear} · Periodo ${journal.period.number}`,
        journal.entryCount === 1 ? '1 registro' : `${journal.entryCount} registros`,
        `Actualizada ${formatShortDate(journal.updatedAt)}`,
      ]}
      actions={
        <ButtonLink
          context={`diario de campo de ${title}`}
          href={`/docente/formatos/diario/${journal.id}`}
          variant="outline"
          size="sm"
          className={styles.stretched}
        >
          Abrir
        </ButtonLink>
      }
    />
  );
}

/** «Diario de campo»: hojas del docente (una por grado y periodo) con filtro por estado. */
export function JournalList() {
  const { state: session } = useSession();
  const teacherId = session.status === 'authenticated' ? session.user.id : undefined;
  const { params, update } = useQueryParams();
  const [creating, setCreating] = useState(false);
  const status = statusFromUrl(params.get('estado'));

  const list = usePagedList<FieldJournalSummary>(
    (page) => listFieldJournals({ teacherId, status, page, pageSize: PAGE_SIZE }),
    JSON.stringify([teacherId, status]),
  );

  if (!teacherId) {
    return null;
  }
  return (
    <>
      <RecordListView
        list={list}
        status={status}
        onStatusChange={(value) => update({ estado: value })}
        intro="Deja registro diario de los eventos relevantes ocurridos en el aula. Cada hoja corresponde a un grado y un periodo, como en el formato institucional."
        action={
          <Button startIcon="mas" onClick={() => setCreating(true)}>
            Nueva hoja de diario
          </Button>
        }
        filterLabel="Filtrar diarios por estado"
        texts={{
          loading: 'Cargando tus hojas de diario…',
          loadError: 'No pudimos cargar tus hojas de diario',
          emptyTitle: 'Aún no tienes hojas de diario',
          emptyBody: 'Crea tu primera hoja con el botón «Nueva hoja de diario».',
          count: (total) => (total === 1 ? '1 hoja' : `${total} hojas`),
        }}
        getKey={(journal) => journal.id}
        renderItem={(journal) => <JournalCard journal={journal} />}
      />
      {creating ? <NewJournalDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

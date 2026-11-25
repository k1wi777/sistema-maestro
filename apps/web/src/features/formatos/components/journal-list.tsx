'use client';

import type { FieldJournalSummary, TodayJournals } from '@gns/shared';
import { useState } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { formatShortDate, formatWeekdayDate } from '@/shared/format/dates';
import { JOURNAL_STATUS_INFO, JOURNAL_STATUS_ORDER, journalStatusFromUrl } from '@/shared/records';
import {
  Button,
  ButtonLink,
  Notice,
  RecordCard,
  FilterBar,
  SegmentedFilter,
  Select,
  StatusBadge,
  type SegmentedOption,
} from '@/shared/ui';

import { useJournalList, useTodayJournals } from '../hooks/use-field-journal';
import { contributionSummary, myObservationsText } from '../model/journal-text';
import { journalDayPath } from '../model/paths';
import { AddAnnotationDialog } from './add-annotation-dialog';
import styles from './formats-list.module.css';

const ALL = 'todos';

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todos' },
  ...JOURNAL_STATUS_ORDER.map((status) => ({
    value: status,
    label: JOURNAL_STATUS_INFO[status].filterLabel,
  })),
];

type TodayGroup = TodayJournals['groups'][number];

/** Tarjeta de «Hoy»: el diario de hoy de un grupo, o la invitación a agregar la primera anotación. */
function TodayCard({ entry, date }: { entry: TodayGroup; date: string }) {
  const journal = entry.journal;
  const info = JOURNAL_STATUS_INFO[journal?.status ?? 'en_curso'];
  const areas = entry.areas.map((area) => area.name).join(', ');
  const progress = journal
    ? `${contributionSummary(journal.readyCount, journal.expectedCount)}${entry.isHomeroomTeacher ? ' · Eres director(a) de grupo' : ''}`
    : `${areas} · aún no has agregado tu anotación`;
  return (
    <RecordCard
      title={entry.group.name}
      headingLevel={3}
      tone={info.tone}
      status={<StatusBadge tone={info.tone}>{journal ? info.label : 'Sin diario'}</StatusBadge>}
      meta={[progress]}
      actions={
        <ButtonLink
          context={entry.group.name}
          href={journalDayPath(entry.group.id, date)}
          variant={journal ? 'outline' : 'primary'}
          size="sm"
        >
          {journal ? 'Abrir diario' : 'Agregar mi anotación'}
        </ButtonLink>
      }
    />
  );
}

function JournalCard({ journal }: { journal: FieldJournalSummary }) {
  const info = JOURNAL_STATUS_INFO[journal.status];
  const notice = myObservationsText(journal.myObservationCount);
  const progress =
    journal.status === 'enviado' && journal.submittedAt
      ? `${journal.readyCount} de ${journal.expectedCount} aportes · enviado el ${formatShortDate(journal.submittedAt)}`
      : journal.status === 'revisado' && journal.reviewer
        ? `${journal.readyCount} de ${journal.expectedCount} aportes · revisado por ${journal.reviewer.fullName}`
        : `${journal.readyCount} de ${journal.expectedCount} aportes`;
  return (
    <RecordCard
      title={journal.group.name}
      headingLevel={2}
      tone={info.tone}
      status={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      meta={[formatWeekdayDate(journal.date), progress, ...(notice ? [notice] : [])]}
      actions={
        <ButtonLink
          context={`diario de ${journal.group.name} del ${journal.date}`}
          href={journalDayPath(journal.group.id, journal.date)}
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

/** «Diario de campo»: bloque «Hoy», filtros por estado y grupo y lista de diarios de sus grupos. */
export function JournalList() {
  const { params, update } = useQueryParams();
  const [adding, setAdding] = useState(false);
  const status = journalStatusFromUrl(params.get('estado'));
  const groupParam = params.get('grupo') ?? undefined;
  const today = useTodayJournals();
  const todayData = today.state.status === 'ready' ? today.state.data : null;
  const groups = todayData?.groups ?? [];
  const groupId = groups.some((entry) => entry.group.id === groupParam) ? groupParam : undefined;
  const list = useJournalList(status, groupId);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Un diario por grupo y día: cada docente que da clase al grupo agrega su anotación y el
          director(a) de grupo lo envía a coordinación.
        </p>
        <Button startIcon="mas" disabled={groups.length === 0} onClick={() => setAdding(true)}>
          Agregar anotación
        </Button>
      </div>

      {today.state.status === 'loading' ? <Loading>Cargando tus grupos…</Loading> : null}
      {today.state.status === 'error' ? (
        <LoadError
          error={today.state.error}
          title="No pudimos cargar tus grupos"
          onRetry={today.reload}
        />
      ) : null}
      {todayData ? (
        groups.length === 0 ? (
          <Notice tone="info" title="Sin grupos asignados">
            Aún no tienes grupos asignados este año. Pídele a coordinación que te los asigne.
          </Notice>
        ) : (
          <section aria-labelledby="journal-today">
            <h2 id="journal-today" className={styles.intro}>
              {`Hoy · ${formatWeekdayDate(todayData.date)}`}
            </h2>
            <ul className={styles.grid}>
              {groups.map((entry) => (
                <li key={entry.group.id} className={styles.item}>
                  <TodayCard entry={entry} date={todayData.date} />
                </li>
              ))}
            </ul>
          </section>
        )
      ) : null}

      <SegmentedFilter
        label="Filtrar diarios por estado"
        options={STATUS_OPTIONS}
        value={status ?? ALL}
        onChange={(value) => update({ estado: value === ALL ? null : value })}
      />
      {groups.length > 1 ? (
        <FilterBar label="Filtros de los diarios" compact>
          <Select
            size="sm"
            label="Grupo"
            placeholder="Todos mis grupos"
            options={groups.map((entry) => ({ value: entry.group.id, label: entry.group.name }))}
            value={groupId ?? ''}
            onChange={(event) => update({ grupo: event.target.value || null })}
          />
        </FilterBar>
      ) : null}

      {list.status === 'loading' ? <Loading>Cargando tus diarios…</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError error={list.error} title="No pudimos cargar tus diarios" onRetry={list.reload} />
      ) : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <Notice tone="info" title={status || groupId ? 'Sin resultados' : 'Aún no hay diarios'}>
          {status || groupId
            ? 'Ningún diario cumple estos filtros. Cambia el estado o el grupo para ver más.'
            : 'Cuando agregues tu primera anotación, el diario del grupo aparecerá aquí.'}
        </Notice>
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <p className={styles.count} role="status">
            {list.totalItems === 1 ? '1 diario' : `${list.totalItems} diarios`}
          </p>
          <ul className={styles.grid}>
            {list.items.map((journal) => (
              <li key={journal.id} className={styles.item}>
                <JournalCard journal={journal} />
              </li>
            ))}
          </ul>
          {list.error ? <LoadError error={list.error} onRetry={list.loadMore} /> : null}
          {list.hasMore ? (
            <div className={styles.more}>
              <Button variant="outline" disabled={list.loadingMore} onClick={list.loadMore}>
                {list.loadingMore ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {adding ? (
        <AddAnnotationDialog
          groups={groups.map((entry) => entry.group)}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

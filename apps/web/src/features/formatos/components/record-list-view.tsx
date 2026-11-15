'use client';

import type { RecordStatus } from '@gns/shared';
import type { ReactNode } from 'react';

import { LoadError, Loading, type PagedList } from '@/shared/data';
import { STATUS_INFO, STATUS_ORDER } from '@/shared/records';
import { Button, Notice, SegmentedFilter, type SegmentedOption } from '@/shared/ui';

import styles from './formats-list.module.css';

const ALL = 'todas';

/** Estado elegido en la URL (`?estado=`): solo se acepta uno de los cinco estados conocidos. */
export function statusFromUrl(value: string | null): RecordStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

const STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: ALL, label: 'Todas' },
  ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_INFO[status].filterLabel })),
];

interface RecordListViewProps<T> {
  list: PagedList<T>;
  status: RecordStatus | undefined;
  onStatusChange: (status: string | null) => void;
  intro: string;
  /** Acción principal («Nueva hoja de diario», «Nueva anotación»). */
  action: ReactNode;
  filterLabel: string;
  /** Textos de los estados vacío, de carga y de error. */
  texts: {
    loading: string;
    loadError: string;
    emptyTitle: string;
    emptyBody: string;
    count: (total: number) => string;
  };
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}

/** Esqueleto común de una lista de formato: introducción y acción, filtro por estado, tarjetas y «Cargar más». */
export function RecordListView<T>({
  list,
  status,
  onStatusChange,
  intro,
  action,
  filterLabel,
  texts,
  renderItem,
  getKey,
}: RecordListViewProps<T>) {
  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>{intro}</p>
        {action}
      </div>
      <SegmentedFilter
        label={filterLabel}
        options={STATUS_OPTIONS}
        value={status ?? ALL}
        onChange={(value) => onStatusChange(value === ALL ? null : value)}
      />

      {list.status === 'loading' ? <Loading>{texts.loading}</Loading> : null}
      {list.status === 'error' && list.error ? (
        <LoadError error={list.error} title={texts.loadError} onRetry={list.reload} />
      ) : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <Notice tone="info" title={status ? 'Sin resultados' : texts.emptyTitle}>
          {status
            ? 'Ningún registro cumple este filtro. Elige otro estado para ver más.'
            : texts.emptyBody}
        </Notice>
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <p className={styles.count} role="status">
            {texts.count(list.totalItems)}
          </p>
          <ul className={styles.grid}>
            {list.items.map((item) => (
              <li key={getKey(item)} className={styles.item}>
                {renderItem(item)}
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
    </div>
  );
}

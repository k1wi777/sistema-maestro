'use client';

import { Card, DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';
import { formatDateTime } from '@/shared/format/dates';

import { moduleTitleWithNumber, TRACKING_STATE_INFO } from '../model/labels';
import { trackingText } from '../model/module-outline';
import type { ModuleDetailRow, ModuleDetailView } from '../model/tracking-view';
import styles from './tracking-screen.module.css';

const COLUMNS: DataTableColumn<ModuleDetailRow>[] = [
  { key: 'teacher', header: 'Docente', render: (row) => row.name },
  {
    key: 'state',
    header: 'Estado',
    render: (row) => {
      const info = TRACKING_STATE_INFO[row.state];
      return <StatusBadge tone={info.tone}>{info.label}</StatusBadge>;
    },
  },
  {
    key: 'score',
    header: 'Mejor puntaje del Desafío',
    numeric: true,
    render: (row) => (row.bestScore === null ? '—' : `${row.bestScore}%`),
  },
  {
    key: 'finished',
    header: 'Terminó',
    render: (row) => (row.completedAt ? formatDateTime(row.completedAt) : '—'),
  },
];

/** Detalle de un módulo: sus totales y, por docente, estado, mejor puntaje y fecha de término. */
export function ModuleDetail({
  view,
  teacherCount,
  emptyMessage,
}: {
  view: ModuleDetailView;
  teacherCount: number;
  emptyMessage: string;
}) {
  const { module, rows } = view;
  return (
    <Card title={`Detalle · ${moduleTitleWithNumber(module)}`}>
      <p className={styles.detailTotals}>
        {trackingText(module.totals, teacherCount)}
        {module.totals.notStarted > 0 ? ` · ${module.totals.notStarted} pendientes` : ''}
      </p>
      <DataTable
        embedded
        caption={`Avance por docente en ${moduleTitleWithNumber(module)}`}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.teacherId}
        emptyMessage={emptyMessage}
      />
    </Card>
  );
}

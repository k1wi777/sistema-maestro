'use client';

import type { PlanTracking } from '@gns/shared';

import { DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';

import { moduleTitleWithNumber, TRACKING_STATE_INFO } from '../model/labels';
import { matrixRows, moduleColumnLabel, type MatrixRow } from '../model/tracking-view';
import styles from './tracking-screen.module.css';

/**
 * Matriz docente × módulo. Las cabeceras se ven como «M3» y su nombre accesible es «Módulo 3 ·
 * título completo»; la leyenda de abajo da el título completo a todos.
 */
export function TrackingMatrix({ tracking, query }: { tracking: PlanTracking; query: string }) {
  const rows = matrixRows(tracking, query);
  const columns: DataTableColumn<MatrixRow>[] = [
    { key: 'teacher', header: 'Docente', render: (row) => row.name },
    ...tracking.modules.map((module, index) => ({
      key: module.id,
      header: moduleColumnLabel(module, index),
      headerLabel: `Módulo ${module.number ?? index + 1} · ${module.title}`,
      render: (row: MatrixRow) => {
        const info = TRACKING_STATE_INFO[row.states[index] ?? 'sin_iniciar'];
        return <StatusBadge tone={info.tone}>{info.label}</StatusBadge>;
      },
    })),
    {
      key: 'progress',
      header: 'Avance',
      numeric: true,
      render: (row) => `${row.percent}%`,
    },
  ];

  return (
    <>
      <DataTable
        caption="Avance por docente en cada módulo del plan"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.teacherId}
        emptyMessage={
          query.trim() === ''
            ? 'Todavía no hay docentes con este plan en su ruta.'
            : 'Ningún docente coincide con la búsqueda.'
        }
      />
      {tracking.modules.length > 0 ? (
        <ul className={styles.legend} aria-label="Módulos del plan">
          {tracking.modules.map((module, index) => (
            <li key={module.id}>
              <b>{moduleColumnLabel(module, index)}</b> {moduleTitleWithNumber(module)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

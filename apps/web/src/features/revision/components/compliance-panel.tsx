'use client';

import type { LessonPlanCompliance } from '@gns/shared';
import { useMemo } from 'react';

import { LoadError, Loading, type Remote } from '@/shared/data';
import { todayInColombia } from '@/shared/format/dates';
import { Card, DataTable, Notice, StatusBadge, type DataTableColumn } from '@/shared/ui';

import { complianceRows, pickPeriod, type ComplianceRow } from '../model/compliance';
import styles from './compliance-panel.module.css';

const COLUMNS: DataTableColumn<ComplianceRow>[] = [
  { key: 'teacher', header: 'Docente', render: (row) => row.teacherName },
  {
    key: 'delivered',
    header: 'Entregadas',
    numeric: true,
    render: (row) => `${row.delivered} de ${row.total}`,
  },
  {
    key: 'percent',
    header: 'Cumplimiento',
    numeric: true,
    render: (row) => `${row.percent} %`,
  },
  {
    key: 'pending',
    header: 'Pendientes',
    render: (row) =>
      row.pending.length === 0 ? (
        <StatusBadge tone="success">Al día</StatusBadge>
      ) : (
        <ul className={styles.pending}>
          {row.pending.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ),
  },
];

interface CompliancePanelProps {
  remote: Remote<LessonPlanCompliance>;
  periodId: string | undefined;
  teacherId: string | undefined;
}

/** Cumplimiento de entregas de un periodo: por docente, entregadas de total y asignaciones pendientes. */
export function CompliancePanel({ remote, periodId, teacherId }: CompliancePanelProps) {
  const ready = remote.state.status === 'ready' ? remote.state.data : null;
  const view = useMemo(() => {
    if (!ready) {
      return null;
    }
    const period = pickPeriod(ready.periods, periodId, todayInColombia());
    if (!period) {
      return { period: null, rows: [] };
    }
    const rows = complianceRows(ready, period.id).filter(
      (row) => !teacherId || row.teacherId === teacherId,
    );
    return { period, rows };
  }, [ready, periodId, teacherId]);

  return (
    <Card
      title={
        view?.period
          ? `Cumplimiento de entregas · Periodo ${view.period.number}`
          : 'Cumplimiento de entregas'
      }
    >
      {remote.state.status === 'loading' ? <Loading>Calculando el cumplimiento…</Loading> : null}
      {remote.state.status === 'error' ? (
        <LoadError
          error={remote.state.error}
          title="No pudimos cargar el cumplimiento"
          onRetry={remote.reload}
        />
      ) : null}
      {view && !view.period ? (
        <Notice tone="info">El año lectivo vigente no tiene periodos definidos.</Notice>
      ) : null}
      {view?.period ? (
        <>
          <p className={styles.note}>
            Planeaciones entregadas (enviadas o revisadas) del periodo, por docente y asignación.
          </p>
          <DataTable
            embedded
            caption="Cumplimiento de entregas por docente"
            columns={COLUMNS}
            rows={view.rows}
            getRowKey={(row) => row.teacherId}
            emptyMessage="No hay asignaciones activas para este periodo."
          />
        </>
      ) : null}
    </Card>
  );
}

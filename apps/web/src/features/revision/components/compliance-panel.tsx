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
  /** Solo los grados de la coordinadora («en tus grados»); sin él, todo el colegio. */
  gradeIds?: ReadonlySet<string>;
}

/** Cumplimiento de entregas de un periodo: por docente, entregadas de total y asignaciones pendientes. */
export function CompliancePanel({ remote, periodId, teacherId, gradeIds }: CompliancePanelProps) {
  const ready = remote.state.status === 'ready' ? remote.state.data : null;
  const view = useMemo(() => {
    if (!ready) {
      return null;
    }
    const period = pickPeriod(ready.periods, periodId, todayInColombia());
    if (!period) {
      return { period: null, rows: [] };
    }
    const rows = complianceRows(ready, period.id, gradeIds).filter(
      (row) => !teacherId || row.teacherId === teacherId,
    );
    return { period, rows };
  }, [ready, periodId, teacherId, gradeIds]);

  return (
    <Card
      title={`${gradeIds ? 'Cumplimiento de entregas en tus grados' : 'Cumplimiento de entregas'}${
        view?.period ? ` · Periodo ${view.period.number}` : ''
      }`}
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

import { ComplianceStatus, type LessonPlanCompliance } from '@gns/shared';

export interface CompliancePeriod {
  id: string;
  number: number;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Periodo del que se muestra el cumplimiento: el pedido en el filtro (si existe); si no, el que
 * contiene `today`; si no, el último ya iniciado; si no, el primero. `null` sin periodos.
 */
export function pickPeriod(
  periods: readonly CompliancePeriod[],
  requestedId: string | undefined,
  today: string,
): CompliancePeriod | null {
  const ordered = [...periods].sort((a, b) => a.number - b.number);
  const requested = ordered.find((period) => period.id === requestedId);
  if (requested) {
    return requested;
  }
  const current = ordered.find(
    (period) =>
      period.startDate !== null &&
      period.endDate !== null &&
      period.startDate <= today &&
      today <= period.endDate,
  );
  if (current) {
    return current;
  }
  const started = ordered.filter(
    (period) => period.startDate !== null && period.startDate <= today,
  );
  return started.at(-1) ?? ordered[0] ?? null;
}

export interface ComplianceRow {
  teacherId: string;
  teacherName: string;
  delivered: number;
  total: number;
  /** Entregadas sobre el total, redondeado a entero. */
  percent: number;
  /** «Grado · área» de las asignaciones sin entregar; vacío si está al día. */
  pending: string[];
}

/** Una fila por docente con asignaciones en el periodo; sin asignaciones no hay fila. */
export function complianceRows(
  compliance: LessonPlanCompliance,
  periodId: string,
): ComplianceRow[] {
  const rows: ComplianceRow[] = [];
  for (const entry of compliance.teachers) {
    const items = entry.items.filter((item) => item.period.id === periodId);
    if (items.length === 0) {
      continue;
    }
    const delivered = items.filter((item) => item.status === ComplianceStatus.Delivered).length;
    rows.push({
      teacherId: entry.teacher.id,
      teacherName: entry.teacher.fullName,
      delivered,
      total: items.length,
      percent: Math.round((delivered / items.length) * 100),
      pending: items
        .filter((item) => item.status !== ComplianceStatus.Delivered)
        .map((item) => `${item.grade.name} · ${item.area.name}`),
    });
  }
  return rows.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'es'));
}

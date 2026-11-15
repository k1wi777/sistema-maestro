import type { FieldJournal } from '@gns/shared';

/**
 * Nombre sugerido del PDF (el navegador lo toma del título del documento al imprimir). Identifica
 * grado y periodo; nunca lleva nombres de estudiantes.
 */
export function journalPrintTitle(journal: Pick<FieldJournal, 'grade' | 'period'>): string {
  return `Diario de campo F-PA-05 – ${journal.grade.name} – Periodo ${journal.period.number}`;
}

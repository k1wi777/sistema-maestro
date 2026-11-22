import { AnnotationStatus, type FieldJournalDay } from '@gns/shared';

import { formatNumericDate, formatNumericDay } from '@/shared/format/dates';

/** El formato F-PA-05 trae 7 filas de datos; con menos anotaciones se completa con filas vacías. */
export const JOURNAL_SHEET_MIN_ROWS = 7;

export interface JournalSheetRow {
  /** `null` en las filas de relleno. */
  key: string | null;
  date: string;
  className: string;
  teacher: string;
  description: string;
}

export interface JournalSheet {
  schoolYear: string;
  level: string;
  /** Número del período que contiene la fecha del diario; vacío si ninguno la contiene. */
  period: string;
  /** Celda libre del encabezado: «GRADO: …». */
  gradeCell: string;
  rows: JournalSheetRow[];
  /** Nombre y fecha de quien aprobó el diario; vacío si no está revisado. */
  reviewedBy: string;
}

/**
 * Texto de la celda libre: el nombre del grupo ya incluye el grado en la mayoría de los casos
 * («7° 1»); si no («Red 1» en Kinder), se antepone el grado.
 */
export function gradeCellText(grade: string, group: string): string {
  return group.startsWith(grade) ? `GRADO: ${group}` : `GRADO: ${grade} · ${group}`;
}

/** Contenido de la hoja impresa del F-PA-05: solo las anotaciones que no son borrador. */
export function buildJournalSheet(journal: FieldJournalDay): JournalSheet {
  const printed: JournalSheetRow[] = journal.annotations
    .filter((annotation) => annotation.status !== AnnotationStatus.Draft)
    .map((annotation) => ({
      key: annotation.id,
      date: formatNumericDay(journal.date),
      className: annotation.area.name,
      teacher: annotation.teacher.fullName,
      description: annotation.description,
    }));
  const filler = Array.from(
    { length: Math.max(0, JOURNAL_SHEET_MIN_ROWS - printed.length) },
    (): JournalSheetRow => ({ key: null, date: '', className: '', teacher: '', description: '' }),
  );
  return {
    schoolYear: journal.schoolYear,
    level: journal.level.name,
    period: journal.period ? String(journal.period.number) : '',
    gradeCell: gradeCellText(journal.grade.name, journal.group.name),
    rows: [...printed, ...filler],
    reviewedBy: journal.signature
      ? `${journal.signature.reviewer.fullName} ${formatNumericDate(journal.signature.date)}`
      : '',
  };
}

import type { LatestDecision } from '@/shared/records/review-feedback';

/** Columnas de `observador_anotacion` que coordinación puede ajustar, con su etiqueta del formulario. */
const COLUMN_LABELS: Record<string, string> = {
  estudiante_nombre: 'Estudiante',
  fecha: 'Fecha',
  tipo: 'Tipo de anotación',
  descripcion: 'Comportamiento específico',
  version_estudiante: 'Descargos o versión del estudiante',
  estrategias_pedagogicas: 'Estrategias pedagógicas',
  acciones: 'Resultados y compromisos',
  familia_informada: 'Se informó a la familia',
  seguimiento: 'Seguimiento',
};

/** Etiquetas de los campos que coordinación ajustó con su decisión; las columnas desconocidas se ignoran. */
export function adjustedNoteFields(decision: Pick<LatestDecision, 'adjustedColumns'>): string[] {
  return decision.adjustedColumns.flatMap((column) => COLUMN_LABELS[column] ?? []);
}

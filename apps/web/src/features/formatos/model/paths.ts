/** Rutas de la feature: cada formato del docente tiene su lista bajo el hub «Formatos». */
export const FORMATS_HUB_PATH = '/docente/formatos';
export const JOURNAL_LIST_PATH = '/docente/formatos/diario';
export const OBSERVER_LIST_PATH = '/docente/formatos/observador';
export const NEW_OBSERVER_NOTE_PATH = '/docente/formatos/observador/nueva';

/** El diario de un grupo en una fecha: la ruta lleva la clave porque puede no existir aún. */
export function journalDayPath(groupId: string, date: string): string {
  return `${JOURNAL_LIST_PATH}/${groupId}/${date}`;
}

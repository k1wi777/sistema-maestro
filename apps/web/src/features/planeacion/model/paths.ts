/** Rutas de la feature: Planeación GNS es un formato más dentro de «Formatos». */
export const PLANNING_PATH = '/docente/formatos/planeacion';

/** Pantalla de una planeación (`/docente/formatos/planeacion/<id>`). */
export function planPath(id: string): string {
  return `${PLANNING_PATH}/${id}`;
}

/** Pantalla «Nueva planeación», con una actividad de partida opcional. */
export function newPlanPath(activityId?: string): string {
  return activityId === undefined
    ? `${PLANNING_PATH}/nueva`
    : `${PLANNING_PATH}/nueva?actividad=${activityId}`;
}

/** Repositorio de ideas de la comunidad (pestaña de la pantalla de planeación). */
export const REPOSITORY_PATH = `${PLANNING_PATH}?pestana=repositorio`;

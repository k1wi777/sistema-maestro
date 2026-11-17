/**
 * Lectura de la estructura para el diario colaborativo (#105 §11): participantes, director(a) y
 * coordinadora de un grupo en un año lectivo. Solo ids y nombres, nunca correos.
 */
export interface GroupRoster {
  group: { id: string; name: string; active: boolean };
  grade: { id: string; name: string; active: boolean; coordinatorId: string | null };
  level: { id: string; name: string };
  /** Director(a) de grupo vigente (asignación activa marcada, usuario activo) o null. */
  homeroom: { id: string; fullName: string } | null;
  /** Docentes activos con asignación activa en el grupo y año, con sus áreas por nombre. */
  teachers: { id: string; fullName: string; areas: { id: string; name: string }[] }[];
}

/** Un grupo del docente con las áreas que tiene en él (asignaciones activas del año). */
export interface MyGroup {
  group: { id: string; name: string; active: boolean };
  grade: { id: string; name: string; active: boolean; sortOrder: number };
  level: { id: string; name: string };
  isHomeroomTeacher: boolean;
  areas: { id: string; name: string }[];
}

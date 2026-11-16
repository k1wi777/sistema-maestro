export interface NamedUser {
  id: string;
  name: string;
}

export interface UserOption {
  value: string;
  label: string;
}

export const UNKNOWN_USER_LABEL = 'Usuario seleccionado';

/**
 * Opciones del selector de usuario sin consulta nueva: los docentes de las asignaciones del año y
 * los usuarios de los movimientos ya cargados, sin duplicados y por nombre. Un usuario elegido
 * (p. ej. desde «Actividad») que aún no tiene nombre conocido se ofrece como «Usuario seleccionado».
 */
export function buildUserOptions(
  teachers: readonly NamedUser[],
  entryUsers: readonly (NamedUser | null)[],
  selectedId?: string,
): UserOption[] {
  const names = new Map<string, string>();
  for (const user of [...teachers, ...entryUsers]) {
    if (user && !names.has(user.id)) {
      names.set(user.id, user.name);
    }
  }
  const options = [...names].map(([value, label]) => ({ value, label }));
  options.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  if (selectedId && !names.has(selectedId)) {
    options.unshift({ value: selectedId, label: UNKNOWN_USER_LABEL });
  }
  return options;
}

import type { TeacherAssignment } from '@gns/shared';

/** Datos de prueba con nombres inventados; solo los usan las pruebas de este módulo. */
export function makeAssignment(overrides: Partial<TeacherAssignment> = {}): TeacherAssignment {
  return {
    id: 'as-1',
    schoolYear: '2026-2027',
    status: 'activa',
    isHomeroomTeacher: false,
    teacher: { id: 't-1', fullName: 'Laura Demo', status: 'activo' },
    group: { id: 'gr-1', name: 'Tercero 1' },
    grade: { id: 'g-1', name: 'Tercero', sortOrder: 3 },
    level: { id: 'l-1', name: 'Primaria' },
    area: { id: 'a-1', name: 'Matemáticas', type: 'asignatura' },
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-01T15:00:00Z'),
    ...overrides,
  };
}

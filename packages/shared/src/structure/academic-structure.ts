import { z } from 'zod';
import { AreaType } from '../constants/area';

const uuid = z.uuid({ error: 'debe ser un UUID' });
const person = z.object({ id: z.uuid(), fullName: z.string() });

/** Grupos de un grado en la lectura de «Grados y áreas». */
const groupEntry = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  /** Hay asignaciones (de cualquier estado) en el grupo: solo se puede desactivar. */
  inUse: z.boolean(),
  /** Director(a) del año vigente; nulo si no hay o si no hay año vigente. */
  homeroomTeacher: person.nullable(),
});

const gradeEntry = z.object({
  id: z.uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  coordinator: person.nullable(),
  /** Hay registros o asignaciones que lo usan: solo se puede desactivar. */
  inUse: z.boolean(),
  groups: z.array(groupEntry),
});

/**
 * Lectura de la página «Grados y áreas» en una sola llamada: niveles con sus grados y grupos,
 * áreas con sus niveles y uso, y coordinadoras con sus grados. Sin correos.
 */
export const academicStructureSchema = z.object({
  schoolYear: z.string().nullable(),
  levels: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      sortOrder: z.number().int(),
      grades: z.array(gradeEntry),
    }),
  ),
  areas: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      type: z.enum(Object.values(AreaType) as [AreaType, ...AreaType[]]),
      active: z.boolean(),
      levelIds: z.array(z.uuid()),
      usageCount: z.number().int(),
    }),
  ),
  coordinators: z.array(person.extend({ gradeIds: z.array(z.uuid()) })),
});
export type AcademicStructure = z.output<typeof academicStructureSchema>;

/** Grados de una coordinadora: reemplaza el conjunto (puede quedar vacío). */
export const setCoordinatorGradesSchema = z
  .object({
    gradeIds: z
      .array(uuid, { error: 'debe ser una lista de grados' })
      .refine((ids) => new Set(ids).size === ids.length, 'no puede repetir grados'),
  })
  .strict();
export type SetCoordinatorGradesInput = z.output<typeof setCoordinatorGradesSchema>;

export const coordinatorGradesSchema = person.extend({ gradeIds: z.array(z.uuid()) });
export type CoordinatorGrades = z.output<typeof coordinatorGradesSchema>;

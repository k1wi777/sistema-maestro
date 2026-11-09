import { z } from 'zod';

export const STUDENT_FIRST_NAME_MAX_LENGTH = 30;
export const STUDENT_WORD_MIN_LENGTH = 2;
export const STUDENT_WORD_MAX_LENGTH = 20;
export const JOURNAL_STUDENTS_MAX_COUNT = 12;
export const JOURNAL_STUDENTS_MAX_LENGTH = 160;

/** Motivo fijo: nunca repite el valor rechazado (puede ser un dato personal de un menor). */
export const STUDENT_FIRST_NAME_REASON =
  'debe ser solo el nombre de pila: una o dos palabras sin apellidos, números ni símbolos';

// Letras Unicode (tildes, ñ, diéresis) con, a lo sumo, un guion o apóstrofo interno.
const WORD = /^\p{L}+(?:['’-]\p{L}+)?$/u;

/** Recorta, normaliza a NFC y reduce los espacios internos repetidos a uno. */
export function normalizeStudentFirstName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

/**
 * Nombre de pila de un estudiante: una o dos palabras de 2 a 20 caracteres (30 en total).
 * Deja pasar «Juan Pérez» (indistinguible de un nombre compuesto sin diccionario); rechaza
 * tres palabras, dígitos, `@`, `.` y otros símbolos.
 */
export function isStudentFirstName(value: string): boolean {
  const name = normalizeStudentFirstName(value);
  if ([...name].length > STUDENT_FIRST_NAME_MAX_LENGTH) {
    return false;
  }
  const words = name.split(' ');
  return (
    words.length <= 2 &&
    words.every((word) => {
      const length = [...word].length;
      return (
        length >= STUDENT_WORD_MIN_LENGTH && length <= STUDENT_WORD_MAX_LENGTH && WORD.test(word)
      );
    })
  );
}

export const studentFirstNameSchema = z
  .string({ error: 'debe ser texto' })
  .transform(normalizeStudentFirstName)
  .refine(isStudentFirstName, { error: STUDENT_FIRST_NAME_REASON });

/** Forma guardada en `diario_entrada.estudiantes`; `null` si la lista está vacía. */
export function joinStudents(names: readonly string[]): string | null {
  return names.length > 0 ? names.join(', ') : null;
}

/** Inversa de `joinStudents` (acepta también `;` como separador). */
export function splitStudents(stored: string | null): string[] {
  return stored ? stored.split(/\s*[,;]\s*/u).filter(Boolean) : [];
}

const duplicateKey = (name: string) => name.toLocaleLowerCase('es');

/** Estudiantes de una entrada del diario: hasta 12 distintos y 160 caracteres unidos. */
export const journalStudentsSchema = z
  .array(studentFirstNameSchema, { error: 'debe ser una lista de nombres de pila' })
  .max(JOURNAL_STUDENTS_MAX_COUNT, `como máximo ${JOURNAL_STUDENTS_MAX_COUNT} estudiantes`)
  .superRefine((names, context) => {
    if (new Set(names.map(duplicateKey)).size !== names.length) {
      context.addIssue({ code: 'custom', message: 'no puede repetir estudiantes' });
    }
    if ((joinStudents(names) ?? '').length > JOURNAL_STUDENTS_MAX_LENGTH) {
      context.addIssue({
        code: 'custom',
        message: `los nombres unidos no pueden superar ${JOURNAL_STUDENTS_MAX_LENGTH} caracteres`,
      });
    }
  });

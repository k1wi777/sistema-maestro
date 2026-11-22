import { z } from 'zod';

export const STUDENT_FIRST_NAME_MAX_LENGTH = 30;
export const STUDENT_WORD_MIN_LENGTH = 2;
export const STUDENT_WORD_MAX_LENGTH = 20;

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

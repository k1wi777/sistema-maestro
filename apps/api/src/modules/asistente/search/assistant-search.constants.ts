/** Puntaje mínimo (fracción de lexemas cubiertos) para responder con una pregunta (R8). */
export const ANSWER_THRESHOLD = 0.6;

/** Puntaje mínimo para ofrecer otra pregunta como relacionada (R10). */
export const RELATED_THRESHOLD = 0.5;

export const MAX_RELATED = 3;
export const MAX_SUGGESTIONS = 4;

/**
 * Palabras de relleno del dominio que las palabras vacías de Snowball no quitan: sin filtrarlas,
 * «¿qué hago con un estudiante?» respondería con la pregunta de llegadas tarde, que las contiene.
 * Se procesan con `gns_spanish` (raíces y sin tildes), así que basta escribirlas una vez.
 */
export const FILLER_WORDS = [
  'hago',
  'hacer',
  'puedo',
  'debo',
  'tengo',
  'sigo',
  'quiero',
  'saber',
  'necesito',
  'estudiante',
  'estudiantes',
  'niño',
  'niños',
  'niña',
  'niñas',
  'alumno',
  'alumnos',
  'docente',
  'profesor',
  'colegio',
  'gns',
  'favor',
  'hola',
  'gracias',
  'pasa',
  'vez',
  'veces',
  'día',
  'hoy',
  'usted',
  'ustedes',
  'mucho',
  'muchos',
  'mucha',
  'muchas',
  'cuánto',
  'tiempo',
] as const;

/** Lista de relleno como un solo texto, para pasarla como parámetro a la consulta. */
export const FILLER_TEXT = FILLER_WORDS.join(' ');

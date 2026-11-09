import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
// El tope evita hashear entradas enormes; no hay reglas de composición (NIST 800-63B).
export const PASSWORD_MAX_LENGTH = 128;

/** Contraseña nueva: 12 a 128 caracteres. */
export const passwordSchema = z
  .string({ error: 'debe ser texto' })
  .min(PASSWORD_MIN_LENGTH, `debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `debe tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`);

import { z } from 'zod';

/** Clave técnica de una tarjeta, entrada, constante o cálculo. */
export const ACTIVITY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export const activityKey = z
  .string()
  .regex(
    ACTIVITY_KEY_PATTERN,
    'La clave debe empezar con una letra minúscula y usar a-z, 0-9 y _ (máximo 32).',
  );

export const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Porcentaje de aciertos necesario para completar una actividad con puntaje. */
export const approvalThreshold = z.number().int().min(0).max(100);

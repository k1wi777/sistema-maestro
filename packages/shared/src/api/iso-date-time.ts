import { z } from 'zod';

/**
 * Fecha y hora en la API: `Date` dentro del servidor y texto ISO 8601 en el JSON.
 * Se usa en los esquemas de respuesta (DTO con `{ codec: true }`) porque un `z.date()`
 * no se puede describir en OpenAPI.
 */
export const isoDateTimeSchema = z.codec(z.iso.datetime(), z.date(), {
  decode: (value) => new Date(value),
  encode: (value) => value.toISOString(),
});

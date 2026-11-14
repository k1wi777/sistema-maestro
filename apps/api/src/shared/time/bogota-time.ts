/** Zona horaria del colegio: única fuente para todo formateo de fechas de la API. */
export const BOGOTA_TIME_ZONE = 'America/Bogota';

// Colombia no tiene horario de verano: el desfase es fijo y el filtro por día no depende de la
// base de datos de zonas horarias.
const BOGOTA_OFFSET = '-05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

function parts(date: Date): Record<string, string> {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(formatted.map((part) => [part.type, part.value]));
}

/** `aaaa-mm-dd` en la hora de Colombia. */
export function formatBogotaDateOnly(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `aaaa-mm-dd HH:mm` en la hora de Colombia. */
export function formatBogotaDateTime(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** `aaaa-mm-dd hh:mm:ss` en la hora de Colombia. */
export function formatBogotaTimestamp(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** Instante en que empieza el día `aaaa-mm-dd` de Colombia (00:00 UTC−5). */
export function startOfBogotaDay(day: string): Date {
  return new Date(`${day}T00:00:00${BOGOTA_OFFSET}`);
}

/** Instante en que empieza el día siguiente de Colombia: límite superior exclusivo de `day`. */
export function startOfNextBogotaDay(day: string): Date {
  return new Date(startOfBogotaDay(day).getTime() + DAY_MS);
}

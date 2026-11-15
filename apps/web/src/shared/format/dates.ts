const TIME_ZONE = 'America/Bogota';
const LOCALE = 'es-CO';

/** Día y mes abreviado como «2 nov» (es-CO escribe «2 de nov»: se arma por partes). */
function dayAndMonth(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone })
    .formatToParts(instant)
    .filter((part) => part.type === 'day' || part.type === 'month');
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${day} ${month.replace(/\./g, '')}`;
}

function parseCalendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Fecha de calendario `AAAA-MM-DD` (sin zona) como «2 nov». */
export function formatDay(date: string): string {
  return dayAndMonth(parseCalendarDate(date), 'UTC');
}

/** Rango de fechas «2 nov – 6 nov»; con una sola fecha, «Desde 2 nov» o «Hasta 6 nov». */
export function formatDateRange(from: string | null, to: string | null): string | null {
  if (from && to) {
    return `${formatDay(from)} – ${formatDay(to)}`;
  }
  if (from) {
    return `Desde ${formatDay(from)}`;
  }
  if (to) {
    return `Hasta ${formatDay(to)}`;
  }
  return null;
}

/** Instante como «7 nov» en hora de Colombia. */
export function formatShortDate(instant: Date): string {
  return dayAndMonth(instant, TIME_ZONE);
}

/** Instante como «7 nov 2026, 10:42 a. m.» en hora de Colombia. */
export function formatDateTime(instant: Date): string {
  const year = new Intl.DateTimeFormat(LOCALE, { year: 'numeric', timeZone: TIME_ZONE }).format(
    instant,
  );
  return `${formatShortDate(instant)} ${year}, ${formatTime(instant)}`;
}

/** Hora de un instante como «10:42 a. m.» en hora de Colombia. */
export function formatTime(instant: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(instant);
}

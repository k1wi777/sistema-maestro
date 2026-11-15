import { formatDateRange, formatDateTime, formatDay, formatShortDate, formatTime } from './dates';

describe('dates', () => {
  it('formats a calendar day without shifting it by the time zone', () => {
    expect(formatDay('2026-11-02')).toBe('2 nov');
    expect(formatDay('2026-01-01')).toBe('1 ene');
  });

  it('formats a range and partial ranges', () => {
    expect(formatDateRange('2026-11-02', '2026-11-06')).toBe('2 nov – 6 nov');
    expect(formatDateRange('2026-11-02', null)).toBe('Desde 2 nov');
    expect(formatDateRange(null, '2026-11-06')).toBe('Hasta 6 nov');
    expect(formatDateRange(null, null)).toBeNull();
  });

  it('uses the Colombia time zone for instants', () => {
    // 03:30 UTC del 8 de noviembre es todavía el 7 a las 10:30 p. m. en Bogotá.
    const instant = new Date('2026-11-08T03:30:00Z');
    expect(formatShortDate(instant)).toBe('7 nov');
    expect(formatTime(instant)).toMatch(/^10:30\s?p\.\s?m\.$/);
    expect(formatDateTime(instant)).toContain('7 nov 2026');
  });
});

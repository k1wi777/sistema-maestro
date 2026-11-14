import {
  formatBogotaDateOnly,
  formatBogotaDateTime,
  formatBogotaTimestamp,
  startOfBogotaDay,
  startOfNextBogotaDay,
} from './bogota-time';

describe('Colombia day limits (R7)', () => {
  it('starts the day at 05:00 UTC', () => {
    expect(startOfBogotaDay('2026-11-14').toISOString()).toBe('2026-11-14T05:00:00.000Z');
  });

  it('ends the day at 05:00 UTC of the next day', () => {
    expect(startOfNextBogotaDay('2026-11-14').toISOString()).toBe('2026-11-15T05:00:00.000Z');
  });

  it('rolls over month and year', () => {
    expect(startOfNextBogotaDay('2026-02-28').toISOString()).toBe('2026-03-01T05:00:00.000Z');
    expect(startOfNextBogotaDay('2026-12-31').toISOString()).toBe('2027-01-01T05:00:00.000Z');
    expect(startOfNextBogotaDay('2028-02-28').toISOString()).toBe('2028-02-29T05:00:00.000Z');
  });
});

describe('Colombia formats (R11, R12)', () => {
  it('writes the timestamp with seconds in Colombia time', () => {
    expect(formatBogotaTimestamp(new Date('2026-11-14T15:04:05Z'))).toBe('2026-11-14 10:04:05');
  });

  it('uses the Colombia calendar day around UTC midnight', () => {
    expect(formatBogotaDateOnly(new Date('2026-11-15T04:30:00Z'))).toBe('2026-11-14');
    expect(formatBogotaDateOnly(new Date('2026-11-15T05:00:00Z'))).toBe('2026-11-15');
    expect(formatBogotaTimestamp(new Date('2027-01-01T04:59:59Z'))).toBe('2026-12-31 23:59:59');
  });

  it('writes midnight as 00 and not 24', () => {
    expect(formatBogotaTimestamp(new Date('2026-11-14T05:00:00Z'))).toBe('2026-11-14 00:00:00');
  });

  it('formats date and time to the minute', () => {
    expect(formatBogotaDateTime(new Date('2026-11-14T02:30:00.000Z'))).toBe('2026-11-13 21:30');
    expect(formatBogotaDateTime(new Date('2026-11-13T05:00:00.000Z'))).toBe('2026-11-13 00:00');
  });
});

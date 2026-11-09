import {
  AUDIT_DATA_MAX_BYTES,
  REDACTED,
  diffFirstLevel,
  normalizeAuditData,
  prepareAuditData,
} from './audit-data';

describe('normalizeAuditData', () => {
  it('converts dates to ISO and bigints to text', () => {
    expect(normalizeAuditData({ at: new Date('2026-11-09T10:00:00Z'), n: 5n })).toEqual({
      at: '2026-11-09T10:00:00.000Z',
      n: '5',
    });
  });

  it('hides the value of secret keys at any depth, ignoring case and separators', () => {
    const result = normalizeAuditData({
      nombre: 'Sofía',
      Password: 'p1',
      password_hash: 'p2',
      nested: { accessToken: 't1', list: [{ apiKey: 'k1', ok: 1 }] },
      secret: { inner: 'x' },
    });
    expect(result).toEqual({
      nombre: 'Sofía',
      Password: REDACTED,
      password_hash: REDACTED,
      nested: { accessToken: REDACTED, list: [{ apiKey: REDACTED, ok: 1 }] },
      secret: REDACTED,
    });
    expect(JSON.stringify(result)).not.toMatch(/p1|p2|t1|k1|inner/);
  });
});

describe('prepareAuditData', () => {
  it('returns null for null or undefined', () => {
    expect(prepareAuditData(null)).toBeNull();
    expect(prepareAuditData(undefined)).toBeNull();
  });

  it('replaces data above 64 KB with the list of fields', () => {
    const big = { a: 'x'.repeat(AUDIT_DATA_MAX_BYTES), b: 1 };
    expect(prepareAuditData(big)).toEqual({ _omitido: 'excede 64 KB', campos: ['a', 'b'] });
  });

  it('keeps data under the limit', () => {
    expect(prepareAuditData({ a: 'x'.repeat(100) })).toEqual({ a: 'x'.repeat(100) });
  });
});

describe('diffFirstLevel', () => {
  it('keeps only the keys whose value changed, on both sides', () => {
    const result = diffFirstLevel(
      { a: 1, b: 'igual', c: { x: 1 }, d: new Date('2026-01-01T00:00:00Z') },
      { a: 2, b: 'igual', c: { x: 2 }, d: new Date('2026-01-01T00:00:00Z') },
    );
    expect(result).toEqual({ before: { a: 1, c: { x: 1 } }, after: { a: 2, c: { x: 2 } } });
  });

  it('reports a changed secret as hidden on both sides without exposing it', () => {
    const result = diffFirstLevel({ passwordHash: 'viejo' }, { passwordHash: 'nuevo' });
    expect(result).toEqual({
      before: { passwordHash: REDACTED },
      after: { passwordHash: REDACTED },
    });
  });

  it('omits an unchanged secret', () => {
    expect(diffFirstLevel({ token: 'a', n: 1 }, { token: 'a', n: 2 })).toEqual({
      before: { n: 1 },
      after: { n: 2 },
    });
  });
});

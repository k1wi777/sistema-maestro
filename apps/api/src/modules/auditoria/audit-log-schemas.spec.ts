import {
  AUDIT_LOG_EXPORT_MAX_ROWS,
  auditLogExportQuerySchema,
  auditLogListQuerySchema,
} from '@gns/shared';

const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('auditLogListQuerySchema (R5, R6, R7)', () => {
  it('defaults the page size to 20', () => {
    expect(auditLogListQuerySchema.parse({}).limit).toBe(20);
  });

  it('accepts every filter together', () => {
    const parsed = auditLogListQuerySchema.parse({
      limit: '100',
      cursor: '123',
      userId,
      role: 'desconocido',
      type: 'ingreso',
      from: '2026-02-28',
      to: '2026-03-01',
    });

    expect(parsed).toMatchObject({ limit: 100, cursor: '123', role: 'desconocido' });
  });

  it.each([
    ['limit 0', { limit: '0' }],
    ['limit 101', { limit: '101' }],
    ['a non numeric limit', { limit: 'diez' }],
    ['a non numeric cursor', { cursor: 'abc' }],
    ['a cursor with sign', { cursor: '-1' }],
    ['a cursor too long for a bigint', { cursor: '9'.repeat(25) }],
    ['a user id that is not a UUID', { userId: '1' }],
    ['an unknown role', { role: 'rector' }],
    ['an unknown type', { type: 'otro' }],
    ['a malformed date', { from: '14/11/2026' }],
    ['an impossible date', { to: '2026-02-30' }],
    ['an unknown parameter', { page: '2' }],
  ])('rejects %s', (_label, query) => {
    expect(auditLogListQuerySchema.safeParse(query).success).toBe(false);
  });

  it('rejects from after to, reporting the issue on to', () => {
    const result = auditLogListQuerySchema.safeParse({ from: '2026-11-15', to: '2026-11-14' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['to']);
  });

  it('accepts the same day as from and to', () => {
    expect(
      auditLogListQuerySchema.safeParse({ from: '2026-11-14', to: '2026-11-14' }).success,
    ).toBe(true);
  });
});

describe('auditLogExportQuerySchema (R11)', () => {
  it('rejects pagination parameters', () => {
    expect(auditLogExportQuerySchema.safeParse({ limit: '10' }).success).toBe(false);
    expect(auditLogExportQuerySchema.safeParse({ cursor: '1' }).success).toBe(false);
  });

  it('applies the same range rule', () => {
    expect(
      auditLogExportQuerySchema.safeParse({ from: '2026-11-15', to: '2026-11-14' }).success,
    ).toBe(false);
  });

  it('keeps the export limit at 10 000 rows (R13)', () => {
    expect(AUDIT_LOG_EXPORT_MAX_ROWS).toBe(10000);
  });
});

import {
  CERTIFICATE_CODE_BITS,
  generateCertificateCode,
  normalizeCertificateCode,
} from './certificate-code';

const FORMAT = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

describe('generateCertificateCode', () => {
  it('has the XXXX-XXXX-XXXX-XXXX format, fits the column and uses 80 bits', () => {
    const code = generateCertificateCode();

    expect(code).toMatch(FORMAT);
    expect(code.length).toBeLessThanOrEqual(20);
    expect(CERTIFICATE_CODE_BITS).toBe(80);
  });

  it('never uses the ambiguous letters I, L, O or U', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateCertificateCode()).not.toMatch(/[ILOU]/);
    }
  });

  it('draws from the whole alphabet (every position is uniform enough)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      for (const char of generateCertificateCode().replaceAll('-', '')) {
        seen.add(char);
      }
    }

    expect(seen.size).toBe(32);
  });

  it('does not repeat in a large sample', () => {
    const codes = new Set(Array.from({ length: 20_000 }, () => generateCertificateCode()));

    expect(codes.size).toBe(20_000);
  });
});

describe('normalizeCertificateCode', () => {
  it('accepts a code as written by a person', () => {
    expect(normalizeCertificateCode('  abcd efgh-jkmn pqrs ')).toBe('ABCD-EFGH-JKMN-PQRS');
    expect(normalizeCertificateCode('abcdefghjkmnpqrs')).toBe('ABCD-EFGH-JKMN-PQRS');
  });

  it('maps O to 0 and I or L to 1', () => {
    expect(normalizeCertificateCode('O0O0-ILIL-1111-0000')).toBe('0000-1111-1111-0000');
  });

  it('round-trips a generated code', () => {
    const code = generateCertificateCode();

    expect(normalizeCertificateCode(code)).toBe(code);
    expect(normalizeCertificateCode(code.toLowerCase())).toBe(code);
  });

  it.each([
    '',
    'ABCD-EFGH-JKMN',
    'ABCD-EFGH-JKMN-PQRS-TVWX',
    'ABCD-EFGH-JKMN-PQRU',
    'ABCD-EFGH-JKMN-PQR$',
    "'; DROP TABLE certificado;--",
    'a'.repeat(10_000),
  ])('returns null for %p', (input) => {
    expect(normalizeCertificateCode(input)).toBeNull();
  });
});

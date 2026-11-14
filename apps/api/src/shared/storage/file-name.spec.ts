import { sanitizeFileName } from './file-name';

describe('sanitizeFileName', () => {
  it('removes accents and replaces unsafe characters', () => {
    expect(sanitizeFileName('Presentación "final"/módulo 1.pptx')).toBe(
      'Presentacion _final__modulo 1.pptx',
    );
  });

  it('never keeps path separators, quotes or control characters', () => {
    const result = sanitizeFileName('..\\..\\etc\r\n/passwd";x');
    expect(result).not.toMatch(/[\\/"\r\n;]/);
  });

  it('drops leading dots and falls back when nothing is left', () => {
    expect(sanitizeFileName('...hidden.pdf')).toBe('hidden.pdf');
    expect(sanitizeFileName('   ')).toBe('archivo');
    expect(sanitizeFileName('')).toBe('archivo');
  });

  it('truncates long names', () => {
    expect(sanitizeFileName('a'.repeat(300)).length).toBe(100);
  });
});

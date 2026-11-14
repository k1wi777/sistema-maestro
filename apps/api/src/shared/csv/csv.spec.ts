import { CSV_BOM, csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('writes plain text, numbers and empty values as they are', () => {
    expect(csvCell('Ana')).toBe('Ana');
    expect(csvCell(85)).toBe('85');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });

  it.each([
    ['=1+1', "'=1+1"],
    ['+57 300', "'+57 300"],
    ['-2+3', "'-2+3"],
    ['@SUMA(A1)', "'@SUMA(A1)"],
    ['\tcmd', "'\tcmd"],
    ['=HYPERLINK("http://x";"y")', `"'=HYPERLINK(""http://x"";""y"")"`],
  ])('neutralizes the formula %p', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('does not touch a symbol that is not at the start', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('Ana-María')).toBe('Ana-María');
  });

  it('quotes cells with the separator, quotes or line breaks and doubles the quotes', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
    expect(csvCell('a,b')).toBe('a,b');
  });

  it('neutralizes a line break at the start by quoting the neutralized text', () => {
    expect(csvCell('\r=1')).toBe('"\'\r=1"');
  });
});

describe('toCsv', () => {
  it('starts with the BOM, separates with semicolons and ends each row with CRLF', () => {
    const csv = toCsv(
      ['Docente', 'Estado'],
      [
        ['Ana', 'Terminado'],
        ['=x', 'En curso'],
      ],
    );

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Docente;Estado\r\nAna;Terminado\r\n'=x;En curso\r\n`);
  });

  it('writes only the header when there are no rows', () => {
    expect(toCsv(['A', 'B'], [])).toBe(`${CSV_BOM}A;B\r\n`);
  });

  it('is valid UTF-8 with accents and eñes', () => {
    const csv = toCsv(['Sección'], [['Ñandú']]);

    expect(Buffer.from(csv, 'utf8').toString('utf8')).toBe(csv);
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });
});

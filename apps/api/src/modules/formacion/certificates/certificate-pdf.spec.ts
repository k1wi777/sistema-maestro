import { inflateSync } from 'node:zlib';
import { formatIssueDate, renderCertificatePdf, type CertificatePdfData } from './certificate-pdf';

const MODULE_CERTIFICATE: CertificatePdfData = {
  teacherName: 'Ana Núñez Peña',
  kind: 'modulo',
  title: 'Introducción al modelo pedagógico GNS',
  planName: 'Inducción 2026-2027',
  issuedAt: new Date('2026-11-13T22:30:00.000Z'),
  code: 'ABCD-EFGH-JKMN-PQRS',
};

/** Texto de las páginas: PDFKit escribe las cadenas en hexadecimal (WinAnsi) dentro de flujos comprimidos. */
function pageText(pdf: Buffer): string {
  const source = pdf.toString('latin1');
  const streams = [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  return (
    streams
      .flatMap((match) => {
        try {
          return [inflateSync(Buffer.from(match[1] ?? '', 'latin1')).toString('latin1')];
        } catch {
          return [];
        }
      })
      .flatMap((content) => [...content.matchAll(/<([0-9a-fA-F]+)>/g)])
      .map((hex) => Buffer.from(hex[1] ?? '', 'hex').toString('latin1'))
      .join(' ')
      // PDFKit separa los pares de letras con ajustes de espaciado: se compara sin espacios.
      .replace(/\s+/g, '')
  );
}

const pageCount = (pdf: Buffer): number =>
  (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

describe('formatIssueDate', () => {
  it('uses Spanish and the Bogotá time zone', () => {
    expect(formatIssueDate(new Date('2026-11-13T22:30:00.000Z'))).toBe('13 de noviembre de 2026');
    // 02:00 UTC del día 14 todavía es el 13 en Bogotá (UTC-5).
    expect(formatIssueDate(new Date('2026-11-14T02:00:00.000Z'))).toBe('13 de noviembre de 2026');
  });
});

describe('renderCertificatePdf', () => {
  it('produces a single-page PDF with the issue date as creation date', async () => {
    const pdf = await renderCertificatePdf(MODULE_CERTIFICATE);

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pageCount(pdf)).toBe(1);
    expect(pdf.toString('latin1')).toMatch(/D:20261113223000Z/);
  });

  it('shows the teacher, the module, the plan, the date and the code', async () => {
    const text = pageText(await renderCertificatePdf(MODULE_CERTIFICATE));

    expect(text).toContain('GeorgeNobleSchool');
    expect(text).toContain('AnaNúñezPeña');
    expect(text).toContain('completóelmódulo«IntroducciónalmodelopedagógicoGNS»');
    expect(text).toContain('delplan«Inducción2026-2027»');
    expect(text).toContain('13denoviembrede2026');
    expect(text).toContain('ABCD-EFGH-JKMN-PQRS');
    expect(text).toContain('VerificaestecertificadoconsucódigoenlaPlataformaGNS');
  });

  it('describes the whole route for the route certificate', async () => {
    const text = pageText(
      await renderCertificatePdf({
        ...MODULE_CERTIFICATE,
        kind: 'ruta',
        title: 'Ruta de formación GNS',
        planName: null,
      }),
    );

    expect(text).toContain('completólarutadeformacióndocente');
    expect(text).not.toContain('módulo');
  });

  it('renders the same bytes for the same data', async () => {
    const [first, second] = await Promise.all([
      renderCertificatePdf(MODULE_CERTIFICATE),
      renderCertificatePdf(MODULE_CERTIFICATE),
    ]);

    // PDFKit incluye un identificador de documento aleatorio: se comparan los flujos de contenido.
    expect(pageText(first)).toBe(pageText(second));
  });

  it('stays on one page with the longest names and titles', async () => {
    const pdf = await renderCertificatePdf({
      ...MODULE_CERTIFICATE,
      teacherName: 'Ñandú '.repeat(20).trim().slice(0, 120),
      title: 'Módulo muy largo '.repeat(10).trim().slice(0, 160),
      planName: 'Plan de área '.repeat(10).trim().slice(0, 120),
    });

    expect(pageCount(pdf)).toBe(1);
  });
});

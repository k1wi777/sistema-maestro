import PDFDocument from 'pdfkit';
import { BOGOTA_TIME_ZONE } from '../../../shared/time/bogota-time';

export interface CertificatePdfData {
  teacherName: string;
  /** `modulo` o `ruta` completa. */
  kind: 'modulo' | 'ruta';
  /** Título del módulo; en la ruta completa, el de la ruta. */
  title: string;
  planName: string | null;
  issuedAt: Date;
  code: string;
}

/** «13 de noviembre de 2026» en la zona horaria del colegio. */
export function formatIssueDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function achievement(data: CertificatePdfData): string {
  if (data.kind === 'ruta') {
    return 'completó la ruta de formación docente';
  }
  return data.planName
    ? `completó el módulo «${data.title}» del plan «${data.planName}»`
    : `completó el módulo «${data.title}»`;
}

/**
 * Certificado de una página con los datos fijados al emitir. Usa las fuentes estándar de PDF
 * (Helvetica, WinAnsi: cubren tildes, ñ, ü, ¿, ¡ y «») y la fecha de emisión como `CreationDate`,
 * así que el mismo certificado produce siempre el mismo contenido. Sin URL ni QR: el dominio de la
 * plataforma aún no está decidido y el PDF se guarda una sola vez.
 */
export function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 60,
      info: {
        Title: 'Certificado GNS',
        Author: 'George Noble School',
        Producer: 'Plataforma GNS',
        Creator: 'Plataforma GNS',
        CreationDate: data.issuedAt,
        ModDate: data.issuedAt,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const centered = { width, align: 'center' } as const;

    doc
      .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .lineWidth(2)
      .stroke('#1f3a5f');

    // El texto fluye hacia abajo: un nombre o un título largos se ajustan sin pisar lo siguiente.
    doc.fillColor('#1f3a5f').font('Helvetica-Bold').fontSize(30);
    doc.text('George Noble School', left, 90, centered);
    doc.moveDown(1.2);

    doc.fillColor('#333333').font('Helvetica').fontSize(16);
    doc.text('certifica que', left, doc.y, centered);
    doc.moveDown(0.8);

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(28);
    doc.text(data.teacherName, left, doc.y, centered);
    doc.moveDown(0.8);

    doc.fillColor('#333333').font('Helvetica').fontSize(18);
    doc.text(achievement(data), left, doc.y, centered);
    doc.moveDown(2);

    doc.fontSize(14);
    doc.text(`Fecha de emisión: ${formatIssueDate(data.issuedAt)}`, left, doc.y, centered);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold');
    doc.text(`Código de verificación: ${data.code}`, left, doc.y, centered);
    doc.moveDown(0.6);

    doc.fillColor('#666666').font('Helvetica').fontSize(11);
    doc.text('Verifica este certificado con su código en la Plataforma GNS', left, doc.y, centered);

    doc.end();
  });
}

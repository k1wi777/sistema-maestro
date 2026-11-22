import type { FieldJournalDay } from '@gns/shared';
import Image from 'next/image';

import { JOURNAL_FORMAT_NOTES } from '../model/labels';
import { buildJournalSheet } from '../model/journal-sheet';
import styles from './journal-print.module.css';

/**
 * Hoja de impresión del F-PA-05 («Exportar PDF»): reproduce el Excel institucional (encabezado,
 * datos generales, tabla FECHA · CLASE · DOCENTE · DESCRIPCIÓN DE EVENTOS, notas y «Revisado por»).
 * Existe siempre en la página pero solo se ve al imprimir. Es una sola tabla de 11 columnas iguales
 * para repetir las combinaciones de celdas del Excel; el encabezado va en `thead` y se repite en
 * cada página; las notas y «Revisado por» van en un segundo `tbody` (un `tfoot` se repetiría en cada
 * página). «PÁGINA 1 DE 1» es el texto fijo del formato. La API no genera este PDF.
 */
export function JournalPrint({ journal }: { journal: FieldJournalDay }) {
  const sheet = buildJournalSheet(journal);
  return (
    <article className={styles.sheet} aria-hidden="true">
      <table className={styles.table}>
        <colgroup>
          {Array.from({ length: 11 }, (_, index) => (
            <col key={index} className={styles.col} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td colSpan={2} rowSpan={3} className={`${styles.cell} ${styles.logo}`}>
              <Image
                src="/escudo-gns.webp"
                alt=""
                width={80}
                height={80}
                className={styles.seal}
                priority
              />
            </td>
            <th colSpan={7} className={`${styles.cell} ${styles.title}`}>
              GEORGE&apos;S NOBLE SCHOOL
            </th>
            <th rowSpan={2} className={`${styles.cell} ${styles.title} ${styles.wrap}`}>
              CÓDIGO: <span className={styles.nowrap}>F-PA-05</span>
            </th>
            <th rowSpan={2} className={`${styles.cell} ${styles.title} ${styles.wrap}`}>
              VERSIÓN: 2
            </th>
          </tr>
          <tr>
            <th colSpan={7} rowSpan={2} className={`${styles.cell} ${styles.title}`}>
              DIARIO DE CAMPO
            </th>
          </tr>
          <tr>
            <th colSpan={2} className={`${styles.cell} ${styles.title}`}>
              PÁGINA 1 DE 1
            </th>
          </tr>
          <tr>
            <th colSpan={11} className={`${styles.cell} ${styles.title} ${styles.wrap}`}>
              Nota: Este formato tiene la función de dejar registro diario de los eventos relevantes
              ocurridos en el Aula de Clases.
            </th>
          </tr>
          <tr>
            <th colSpan={3} className={`${styles.cell} ${styles.fact}`}>
              AÑO LECTIVO: {sheet.schoolYear}
            </th>
            <th colSpan={3} className={`${styles.cell} ${styles.fact}`}>
              NIVEL: {sheet.level}
            </th>
            <th colSpan={2} className={`${styles.cell} ${styles.fact}`}>
              PERÍODO: {sheet.period}
            </th>
            <th colSpan={3} className={`${styles.cell} ${styles.fact}`}>
              {sheet.gradeCell}
            </th>
          </tr>
          <tr className={styles.columns}>
            <th scope="col" className={styles.cell}>
              FECHA
            </th>
            <th scope="col" colSpan={2} className={styles.cell}>
              CLASE
            </th>
            <th scope="col" colSpan={2} className={styles.cell}>
              DOCENTE
            </th>
            <th scope="col" colSpan={6} className={styles.cell}>
              DESCRIPCIÓN DE EVENTOS
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, index) => (
            <tr key={row.key ?? `blank-${index}`} className={styles.row}>
              <td className={`${styles.cell} ${styles.date}`}>{row.date}</td>
              <td colSpan={2} className={`${styles.cell} ${styles.centered}`}>
                {row.className}
              </td>
              <td colSpan={2} className={`${styles.cell} ${styles.centered}`}>
                {row.teacher}
              </td>
              <td colSpan={6} className={`${styles.cell} ${styles.description}`}>
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
        <tbody className={styles.closing}>
          <tr className={styles.notesRow}>
            <td colSpan={11} className={styles.notes}>
              Notas: 1. {JOURNAL_FORMAT_NOTES[0]} 2. {JOURNAL_FORMAT_NOTES[1]}
            </td>
          </tr>
          <tr>
            <th className={styles.reviewLabel}>REVISADO POR:</th>
            <td colSpan={5} className={styles.reviewer}>
              {sheet.reviewedBy}
            </td>
            <td colSpan={5} className={styles.noBorder} />
          </tr>
        </tbody>
      </table>
    </article>
  );
}

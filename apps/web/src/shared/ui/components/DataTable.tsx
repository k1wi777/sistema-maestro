import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './DataTable.module.css';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  /** Nombre accesible completo: si existe, `header` se pinta como texto corto oculto a lectores. */
  headerLabel?: string;
  render: (row: Row) => ReactNode;
  /** Alinea a la derecha y usa números tabulares. */
  numeric?: boolean;
}

export interface DataTableProps<Row> {
  /** Descripción de la tabla para lectores de pantalla; visible solo si `showCaption`. */
  caption: string;
  showCaption?: boolean;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Dentro de un `Card`: sin segunda tarjeta, a sangre con el padding del bloque. */
  embedded?: boolean;
  emptyMessage?: string;
  className?: string;
}

/** Tabla semántica con encabezado sobrio; en celular se desplaza dentro de su contenedor. */
export function DataTable<Row>({
  caption,
  showCaption = false,
  columns,
  rows,
  getRowKey,
  embedded = false,
  emptyMessage = 'No hay registros para mostrar.',
  className,
}: DataTableProps<Row>) {
  return (
    <div className={cx(styles.wrapper, embedded && styles.embedded, className)}>
      <div className={styles.scroller} tabIndex={0} role="region" aria-label={caption}>
        <table className={styles.table}>
          <caption className={showCaption ? styles.caption : 'sr-only'}>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cx(column.numeric && styles.numeric)}>
                  {column.headerLabel ? (
                    <>
                      <span aria-hidden="true">{column.header}</span>
                      <span className="sr-only">{column.headerLabel}</span>
                    </>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column, index) =>
                    index === 0 ? (
                      <th
                        key={column.key}
                        scope="row"
                        className={cx(styles.rowHeader, column.numeric && styles.numeric)}
                      >
                        {column.render(row)}
                      </th>
                    ) : (
                      <td key={column.key} className={cx(column.numeric && styles.numeric)}>
                        {column.render(row)}
                      </td>
                    ),
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useId, type ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import { cx } from './cx';
import styles from './Field.module.css';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  /** Etiqueta en línea (junto al control), p. ej. para filtros. */
  inline?: boolean;
  /** `sm`: etiqueta compacta en mayúsculas para las barras de filtros. */
  size?: 'sm';
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Une etiqueta, ayuda y error con el control mediante `htmlFor` y `aria-describedby`. */
export function Field({
  label,
  help,
  error,
  required,
  inline,
  size,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={cx(
        styles.field,
        inline && styles.inline,
        size === 'sm' && styles.small,
        className,
      )}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

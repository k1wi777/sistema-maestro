'use client';

import { useEffect, useId, useRef, type InputHTMLAttributes } from 'react';

import { Icon } from '../icons/Icon';
import { cx } from './cx';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'children'
> {
  label: string;
  help?: string;
  error?: string;
  /** Estado mixto (p. ej. «Marcar todo» con solo algunas marcadas); se anuncia como «mixto». */
  indeterminate?: boolean;
}

export function Checkbox({ label, help, error, indeterminate, className, ...rest }: CheckboxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // `indeterminate` solo existe como propiedad del DOM, no como atributo.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx(styles.wrapper, className)}>
      <div className={styles.row}>
        <input
          {...rest}
          ref={inputRef}
          id={id}
          type="checkbox"
          className={styles.box}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      </div>
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

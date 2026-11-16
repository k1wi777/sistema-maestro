import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/registry';
import styles from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'outline' | 'void';
export type ButtonSize = 'md' | 'sm';

interface ButtonLookProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: IconName;
  endIcon?: IconName;
  /**
   * Contexto para lectores de pantalla («pregunta frecuente «X»»): el nombre accesible pasa a ser
   * «<texto visible> <contexto>» (WCAG 2.5.3), igual en todos los navegadores. Requiere que el
   * contenido visible sea texto.
   */
  context?: string;
  children: ReactNode;
}

/** Texto plano de un contenido compuesto solo por cadenas y números (para el nombre accesible). */
function plainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(plainText).join('');
  }
  return '';
}

/** Nombre accesible de un control con contexto: «<texto visible> <contexto>». */
function labelWithContext(children: ReactNode, context: string | undefined): string | undefined {
  if (!context) {
    return undefined;
  }
  return `${plainText(children).trim()} ${context}`;
}

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return cx(styles.button, styles[variant], size === 'sm' && styles.small, className);
}

function ButtonContent({
  size = 'md',
  startIcon,
  endIcon,
  children,
}: Pick<ButtonLookProps, 'size' | 'startIcon' | 'endIcon' | 'children'>) {
  const iconSize = size === 'sm' ? 16 : 17;
  return (
    <>
      {startIcon ? <Icon name={startIcon} size={iconSize} /> : null}
      <span>{children}</span>
      {endIcon ? <Icon name={endIcon} size={iconSize} /> : null}
    </>
  );
}

export type ButtonProps = ButtonLookProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonLookProps>;

export function Button({
  variant = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  context,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      aria-label={labelWithContext(children, context)}
      {...rest}
    >
      <ButtonContent size={size} startIcon={startIcon} endIcon={endIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps extends ButtonLookProps {
  href: string;
  className?: string;
  target?: string;
  rel?: string;
}

/** Enlace con el aspecto de un botón (navega; no ejecuta acciones). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  context,
  children,
  className,
  href,
  target,
  rel,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={buttonClass(variant, size, className)}
      aria-label={labelWithContext(children, context)}
    >
      <ButtonContent size={size} startIcon={startIcon} endIcon={endIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}

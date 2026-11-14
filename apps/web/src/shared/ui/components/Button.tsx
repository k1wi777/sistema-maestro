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
  children: ReactNode;
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
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
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
  children,
  className,
  href,
  target,
  rel,
}: ButtonLinkProps) {
  return (
    <Link href={href} target={target} rel={rel} className={buttonClass(variant, size, className)}>
      <ButtonContent size={size} startIcon={startIcon} endIcon={endIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}

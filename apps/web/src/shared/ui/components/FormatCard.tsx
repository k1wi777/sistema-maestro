import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { FillableIconName } from '../icons/registry';
import { cx } from './cx';
import styles from './FormatCard.module.css';
import { StatusBadge } from './StatusBadge';

export interface FormatCardProps {
  title: string;
  description: string;
  icon: FillableIconName;
  /** Destino de la tarjeta; sin él (con `soon`) la tarjeta no es interactiva. */
  href?: string;
  /** Nivel del encabezado para no romper la jerarquía de la página. */
  headingLevel?: 2 | 3;
  /** Dato breve junto al título (p. ej. «3 pendientes»). */
  badge?: ReactNode;
  /** El formato aún no existe: se muestra «Pronto», sin enlace ni acción. */
  soon?: boolean;
  className?: string;
}

/** Tarjeta de navegación de un formato: con `href` es un enlace completo; con `soon`, informativa. */
export function FormatCard({
  title,
  description,
  icon,
  href,
  headingLevel = 2,
  badge,
  soon = false,
  className,
}: FormatCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const content = (
    <>
      <span className={styles.icon}>
        <Icon name={icon} size={22} fill="tone" />
      </span>
      <span className={styles.text}>
        <Heading className={styles.title}>{title}</Heading>
        <span className={styles.description}>{description}</span>
      </span>
      {soon ? <StatusBadge>Pronto</StatusBadge> : (badge ?? null)}
      {href ? <Icon name="flecha" size={20} className={styles.arrow} /> : null}
    </>
  );

  if (href && !soon) {
    return (
      <Link href={href} className={cx(styles.card, styles.link, className)}>
        {content}
      </Link>
    );
  }
  return <article className={cx(styles.card, styles.soon, className)}>{content}</article>;
}

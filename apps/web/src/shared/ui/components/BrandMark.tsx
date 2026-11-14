import Image from 'next/image';

import { cx } from './cx';
import styles from './BrandMark.module.css';

export interface BrandMarkProps {
  /** Texto bajo el nombre (lema o contexto). */
  tagline?: string;
  /** Sobre fondo oscuro (menú azul turquí): texto claro. */
  onDark?: boolean;
  className?: string;
}

/** Escudo y nombre del colegio. Josefin Sans solo se usa aquí, en la marca. */
export function BrandMark({ tagline, onDark = false, className }: BrandMarkProps) {
  return (
    <div className={cx(styles.brand, onDark && styles.onDark, className)}>
      <Image
        src="/escudo-gns.webp"
        alt=""
        width={80}
        height={80}
        className={styles.seal}
        priority
      />
      <div className={styles.text}>
        <span className={styles.name}>George Noble School</span>
        {tagline ? <span className={styles.tagline}>{tagline}</span> : null}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { FillableIconName } from '../icons/registry';
import { cx } from './cx';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const TONE_ICON: Record<NoticeTone, FillableIconName> = {
  info: 'info',
  success: 'exito',
  warning: 'alerta',
  error: 'error',
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Aviso con icono y texto (nunca solo color). Los errores se anuncian con `alert`. */
export function Notice({ tone = 'info', title, className, children }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(styles.notice, styles[tone], className)}
    >
      <Icon name={TONE_ICON[tone]} size={20} fill="tone" className={styles.icon} />
      <div className={styles.body}>
        {title ? <strong className={styles.title}>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

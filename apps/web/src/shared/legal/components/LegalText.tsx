import { Fragment } from 'react';

import { StatusBadge } from '@/shared/ui';

import type { Inline } from '../content/document';
import { LEGAL_PENDING } from '../content/pending';
import styles from './legal.module.css';

/** Pinta un fragmento legal: el texto tal cual o, si es un dato sin confirmar, la marca «Pendiente». */
export function LegalText({ content }: { content: readonly Inline[] }) {
  return (
    <>
      {content.map((part, index) =>
        typeof part === 'string' ? (
          <Fragment key={index}>{part}</Fragment>
        ) : (
          <span key={index} className={styles.pending}>
            <StatusBadge tone="warning">Pendiente</StatusBadge>{' '}
            <span className={styles.pendingText}>{LEGAL_PENDING[part.id]}</span>
          </span>
        ),
      )}
    </>
  );
}

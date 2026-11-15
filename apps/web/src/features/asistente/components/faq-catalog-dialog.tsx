'use client';

import type { FaqView } from '@gns/shared';
import { useMemo } from 'react';

import { Button, Dialog } from '@/shared/ui';

import { groupByCategory } from '../model/starters';
import { Suggestions } from './assistant-message';
import styles from './assistant.module.css';

/** «Ver todas las preguntas»: las preguntas activas agrupadas por categoría; elegir una la consulta. */
export function FaqCatalogDialog({
  faqs,
  busy,
  onPick,
  onClose,
}: {
  faqs: readonly FaqView[];
  busy: boolean;
  onPick: (question: string) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => groupByCategory(faqs), [faqs]);
  return (
    <Dialog
      open
      wide
      title="Todas las preguntas"
      description="Elige una pregunta para ver su respuesta."
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {groups.length === 0 ? (
        <p className={styles.note}>Aún no hay preguntas programadas.</p>
      ) : null}
      {groups.map((group) => (
        <section key={group.category} className={styles.catalogGroup}>
          <h3 className={styles.catalogTitle}>{group.category}</h3>
          <Suggestions
            items={group.faqs}
            disabled={busy}
            onPick={(question) => {
              onPick(question);
              onClose();
            }}
          />
        </section>
      ))}
    </Dialog>
  );
}

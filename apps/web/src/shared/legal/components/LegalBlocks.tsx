import type { LegalBlock } from '../content/document';
import styles from './legal.module.css';
import { LegalText } from './LegalText';

export interface LegalBlocksProps {
  blocks: readonly LegalBlock[];
  /** Abre los enlaces externos en otra pestaña (en el aviso, para no perder las casillas). */
  newTab?: boolean;
}

/** Recorre los bloques de un texto legal; no contiene ningún texto propio. */
export function LegalBlocks({ blocks, newTab }: LegalBlocksProps) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={index} className={styles.paragraph}>
                <LegalText content={block.content} />
              </p>
            );
          case 'list':
            return (
              <ul key={index} className={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <LegalText content={item} />
                  </li>
                ))}
              </ul>
            );
          case 'link':
            return (
              <p key={index} className={styles.paragraph}>
                <a
                  href={block.href}
                  target={newTab ? '_blank' : undefined}
                  rel="noopener noreferrer"
                >
                  {block.label}
                </a>
              </p>
            );
        }
      })}
    </>
  );
}

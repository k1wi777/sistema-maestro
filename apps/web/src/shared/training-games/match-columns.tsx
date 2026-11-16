import { emojiIcon, Icon } from '@/shared/ui';

import styles from './match-columns.module.css';

export interface MatchColumnsProps {
  concepts: readonly { token: string; concepto: string; emoji?: string | undefined }[];
  facts: readonly { token: string; dato: string }[];
  connectedConcepts?: readonly string[];
  connectedFacts?: readonly string[];
  selectedConcept?: string | null;
  selectedFact?: string | null;
  /** Se puede tocar ahora (si no, los botones quedan con `aria-disabled`). */
  interactive?: boolean;
  /** Vista previa: todos los botones deshabilitados. */
  disabled?: boolean;
  onSelectConcept?: (token: string) => void;
  onSelectFact?: (token: string) => void;
}

/** Las dos columnas de Conecta: conceptos y datos como botones reales. */
export function MatchColumns({
  concepts,
  facts,
  connectedConcepts = [],
  connectedFacts = [],
  selectedConcept = null,
  selectedFact = null,
  interactive = true,
  disabled = false,
  onSelectConcept,
  onSelectFact,
}: MatchColumnsProps) {
  return (
    <div className={styles.columns}>
      <ul className={styles.column} aria-label="Conceptos">
        {concepts.map((item) => {
          const connected = connectedConcepts.includes(item.token);
          const selected = selectedConcept === item.token;
          return (
            <li key={item.token}>
              <button
                type="button"
                className={`${styles.concept} ${selected ? styles.selected : ''} ${
                  connected ? styles.connected : ''
                }`}
                disabled={connected || disabled}
                aria-disabled={!connected && !interactive ? true : undefined}
                aria-pressed={connected ? undefined : selected}
                onClick={() => onSelectConcept?.(item.token)}
              >
                <Icon name={connected ? 'check' : emojiIcon(item.emoji)} size={18} />
                <span>{item.concepto}</span>
                {connected ? <span className="sr-only"> (conectado)</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <ul className={styles.column} aria-label="Datos">
        {facts.map((item) => {
          const connected = connectedFacts.includes(item.token);
          const selected = selectedFact === item.token;
          return (
            <li key={item.token}>
              <button
                type="button"
                className={`${styles.fact} ${selected ? styles.selected : ''} ${
                  connected ? styles.connected : ''
                }`}
                disabled={connected || disabled}
                aria-disabled={!connected && !interactive ? true : undefined}
                aria-pressed={connected ? undefined : selected}
                onClick={() => onSelectFact?.(item.token)}
              >
                {connected ? <Icon name="check" size={18} /> : null}
                <span>{item.dato}</span>
                {connected ? <span className="sr-only"> (conectado)</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

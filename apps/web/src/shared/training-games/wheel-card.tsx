import { emojiIcon, Icon } from '@/shared/ui';

import type { WheelCardConfig } from './wheel';
import styles from './wheel.module.css';

/** Tarjeta del beneficio con su pregunta. En la vista previa las opciones van deshabilitadas. */
export function WheelCard({
  card,
  question,
  chosen,
  correctIndex,
  disabled,
  kicker,
  onChoose,
}: {
  card: WheelCardConfig;
  question: boolean;
  chosen: number | null;
  correctIndex: number | null;
  disabled: boolean;
  kicker: string;
  onChoose: (index: number) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <Icon name={emojiIcon(card.emoji)} size={30} />
        </span>
        <div>
          <span className={styles.kicker}>{kicker}</span>
          <h4 className={styles.cardTitle}>{card.titulo}</h4>
        </div>
      </div>
      <p className={styles.fact}>{card.dato}</p>
      <ul className={styles.facts}>
        {card.hechos.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {card.enlace ? (
        <a className={styles.link} href={card.enlace.url} target="_blank" rel="noopener noreferrer">
          {card.enlace.texto}
          <Icon name="externo" size={14} />
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : null}
      {question ? (
        <div className={styles.question}>
          <b>{`Gana el sello: ${card.pregunta.enunciado}`}</b>
          <div className={styles.options}>
            {card.pregunta.opciones.map((option, index) => {
              const isCorrect = correctIndex === index;
              const isWrong = correctIndex !== null && chosen === index && !isCorrect;
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.option} ${isCorrect ? styles.optionOk : ''} ${
                    isWrong ? styles.optionBad : ''
                  }`}
                  disabled={disabled}
                  aria-pressed={chosen === index && correctIndex === null ? true : undefined}
                  onClick={() => onChoose(index)}
                >
                  {option}
                  {isCorrect ? <span className="sr-only"> (respuesta correcta)</span> : null}
                  {isWrong ? <span className="sr-only"> (tu respuesta)</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

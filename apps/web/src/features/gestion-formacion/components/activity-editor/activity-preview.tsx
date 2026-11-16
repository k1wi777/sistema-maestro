'use client';

import {
  parseActivityConfig,
  TrainingActivityType,
  type MatchConfig,
  type SimulatorConfig,
  type TrueOrMythConfig,
  type WheelPassportConfig,
} from '@gns/shared';
import { useState } from 'react';

import { Button, Notice, Select } from '@/shared/ui';
import {
  gameFrame,
  MatchColumns,
  Passport,
  sharedKey,
  SimulatorPanel,
  StatementCard,
  WheelCard,
  WheelFace,
  type SharedValues,
} from '@/shared/training-games';

import styles from './activity-editor.module.css';

/** Lo que la vista previa necesita de una actividad (guardada o borrador ya válido). */
export interface PreviewActivity {
  type: TrainingActivityType;
  title: string;
  config: unknown;
}

function WheelPreview({ config }: { config: WheelPassportConfig }) {
  const [index, setIndex] = useState(0);
  const card = config.tarjetas[Math.min(index, config.tarjetas.length - 1)];
  return (
    <div className={styles.previewLayout}>
      <div className={`${gameFrame.game} ${styles.previewGame}`}>
        <WheelFace cards={config.tarjetas} />
      </div>
      <div className={styles.preview}>
        <Select
          label="Tarjeta"
          value={String(index)}
          options={config.tarjetas.map((item, position) => ({
            value: String(position),
            label: `${position + 1} · ${item.titulo_corto}`,
          }))}
          onChange={(event) => setIndex(Number(event.target.value))}
        />
        {card ? (
          <WheelCard
            card={card}
            question
            chosen={null}
            correctIndex={null}
            disabled
            kicker="¡Descubriste un beneficio!"
            onChoose={() => undefined}
          />
        ) : null}
        <Passport cards={config.tarjetas} stamps={[]} badge={config.insignia} />
      </div>
    </div>
  );
}

function MatchPreview({ config }: { config: MatchConfig }) {
  const pairs = config.pares.slice(0, config.pares_por_ronda);
  return (
    <div className={styles.preview}>
      <ul className={styles.previewRules}>
        <li>{config.rondas === 1 ? '1 ronda' : `${config.rondas} rondas`}</li>
        <li>{`${config.pares_por_ronda} parejas por ronda`}</li>
        <li>{`${config.segundos_por_ronda} s por ronda`}</li>
        <li>{`Apruebas con ${config.umbral_aprobacion}%`}</li>
      </ul>
      <div className={gameFrame.game}>
        <MatchColumns
          disabled
          interactive={false}
          concepts={pairs.map((pair, index) => ({
            token: `c${index}`,
            concepto: pair.concepto,
            emoji: pair.emoji,
          }))}
          facts={pairs.map((pair, index) => ({ token: `f${index}`, dato: pair.dato }))}
        />
      </div>
      <p className={styles.previewNote}>
        En el juego, los pares se eligen y se mezclan al azar en cada partida.
      </p>
    </div>
  );
}

function TrueOrMythPreview({ config }: { config: TrueOrMythConfig }) {
  const [index, setIndex] = useState(0);
  const last = config.afirmaciones.length - 1;
  const current = Math.min(index, last);
  const statement = config.afirmaciones[current];
  return (
    <div className={styles.preview}>
      <ul className={styles.previewRules}>
        <li>{`${config.por_partida} afirmaciones por partida`}</li>
        <li>{config.vidas === 1 ? '1 vida' : `${config.vidas} vidas`}</li>
        <li>{`${config.segundos_por_afirmacion} s por afirmación`}</li>
        <li>{`Apruebas con ${config.umbral_aprobacion}%`}</li>
      </ul>
      <div className={styles.statementNav}>
        <Button
          variant="outline"
          size="sm"
          startIcon="volver"
          disabled={current === 0}
          onClick={() => setIndex(current - 1)}
        >
          Anterior
        </Button>
        <span className={styles.previewNote} aria-live="polite">
          {`Afirmación ${current + 1} de ${config.afirmaciones.length}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          endIcon="siguiente"
          disabled={current === last}
          onClick={() => setIndex(current + 1)}
        >
          Siguiente
        </Button>
      </div>
      {statement ? (
        <>
          <div className={`${gameFrame.game} ${styles.previewGame}`}>
            <StatementCard
              text={statement.texto}
              remaining={config.segundos_por_afirmacion}
              graded={null}
              open={false}
            />
          </div>
          <p className={styles.explanation}>
            <b>{statement.es_verdad ? 'Era verdad. ' : 'Era mito. '}</b>
            {statement.explicacion}
          </p>
        </>
      ) : null}
    </div>
  );
}

function SimulatorPreview({ config }: { config: SimulatorConfig }) {
  const [shared, setShared] = useState<SharedValues>({});
  return (
    <SimulatorPanel
      config={config}
      shared={shared}
      onChange={(input, value) =>
        setShared((current) => {
          const next = { ...current };
          if (value === null) {
            delete next[sharedKey(input)];
          } else {
            next[sharedKey(input)] = value;
          }
          return next;
        })
      }
    />
  );
}

/**
 * Vista previa de una actividad tal como la verá el docente, con las mismas piezas que su vista.
 * No califica, no llama a la API de juegos y no guarda progreso: lo escrito en el simulador solo
 * vive en memoria.
 */
export function ActivityPreview({ activity }: { activity: PreviewActivity }) {
  let body;
  switch (activity.type) {
    case TrainingActivityType.WheelPassport: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      body = parsed.success ? <WheelPreview config={parsed.data} /> : null;
      break;
    }
    case TrainingActivityType.Match: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      body = parsed.success ? <MatchPreview config={parsed.data} /> : null;
      break;
    }
    case TrainingActivityType.TrueOrMyth: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      body = parsed.success ? <TrueOrMythPreview config={parsed.data} /> : null;
      break;
    }
    case TrainingActivityType.Simulator: {
      const parsed = parseActivityConfig(activity.type, activity.config);
      body = parsed.success ? <SimulatorPreview config={parsed.data} /> : null;
      break;
    }
  }
  if (body === null) {
    return (
      <Notice tone="warning">
        Esta actividad no se puede previsualizar porque su configuración no es válida.
      </Notice>
    );
  }
  return (
    <div className={styles.preview} aria-label={`Vista previa: ${activity.title}`} role="group">
      <p className={styles.previewNote}>Vista previa: no se califica ni guarda progreso.</p>
      {body}
    </div>
  );
}

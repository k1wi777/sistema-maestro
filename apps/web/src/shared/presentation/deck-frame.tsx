'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { Button } from '@/shared/ui';

import styles from './deck.module.css';

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

const noSubscription = () => () => undefined;

/**
 * Marco común de los visores de presentación (diapositivas de la plataforma y PDF): grupo con
 * foco y nombre accesible, flechas del teclado, «Anterior» y «Siguiente», contador en una región
 * viva y pantalla completa donde el navegador la admite. Quien lo usa pone el contenido de la
 * página o diapositiva (recibe si está en pantalla completa) y las acciones extra.
 */
export function DeckFrame({
  name,
  index,
  total,
  counterLabel,
  onGo,
  actions,
  children,
  below,
}: {
  /** Nombre de la presentación, para el grupo enfocable. */
  name: string;
  /** Posición actual (base 0) y total de páginas o diapositivas. */
  index: number;
  total: number;
  /** Texto del contador, p. ej. «Página 2 de 5». */
  counterLabel: string;
  onGo: (index: number) => void;
  /** Acciones propias del visor, junto a «Pantalla completa». */
  actions?: ReactNode;
  /** Contenido de la página; recibe si el visor está en pantalla completa. */
  children: (fullscreen: boolean) => ReactNode;
  /** Avisos bajo los controles (marca de revisada, errores de la marca). */
  below?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const supported = useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled,
    () => false,
  );
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null && document.fullscreenElement === frameRef.current,
    () => false,
  );

  // El foco vuelve al marco al entrar y salir de pantalla completa, para seguir con el teclado.
  useEffect(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, [fullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frameRef.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const last = total - 1;

  // Al llegar al primer o al último elemento, el botón que se pulsó queda deshabilitado y el foco
  // se perdería: pasa al marco, donde siguen funcionando las flechas.
  function goFromButton(next: number) {
    onGo(next);
    if (next <= 0 || next >= last) {
      frameRef.current?.focus({ preventScroll: true });
    }
  }
  return (
    <div
      ref={frameRef}
      className={fullscreen ? `${styles.frame} ${styles.full}` : styles.frame}
      tabIndex={0}
      role="group"
      aria-label={`Presentación: ${name}; usa las flechas del teclado para avanzar`}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          onGo(Math.min(last, index + 1));
        } else if (event.key === 'ArrowLeft') {
          onGo(Math.max(0, index - 1));
        }
      }}
    >
      <div className={styles.content}>{children(fullscreen)}</div>
      <div className={styles.controls}>
        <Button
          variant="outline"
          size="sm"
          startIcon="volver"
          disabled={index <= 0}
          onClick={() => goFromButton(index - 1)}
        >
          Anterior
        </Button>
        <span className={styles.count} role="status" aria-live="polite">
          {counterLabel}
        </span>
        <Button
          variant="secondary"
          size="sm"
          endIcon="siguiente"
          disabled={index >= last}
          onClick={() => goFromButton(index + 1)}
        >
          Siguiente
        </Button>
      </div>
      {supported || actions ? (
        <div className={styles.actions}>
          {supported ? (
            <Button
              variant="outline"
              size="sm"
              startIcon={fullscreen ? 'reducir' : 'ampliar'}
              onClick={toggleFullscreen}
            >
              {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
      {below}
    </div>
  );
}

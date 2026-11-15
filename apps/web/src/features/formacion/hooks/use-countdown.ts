'use client';

import { useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

/**
 * Cuenta regresiva solo visual: parte de `seconds` cuando `active` pasa a verdadero y llama a
 * `onExpire` una sola vez al llegar a cero. La API tiene el reloj real (con su margen de latencia),
 * así que el cliente no compensa nada. Al dejar de estar activa, la cuenta se congela.
 */
export function useCountdown(seconds: number, active: boolean, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!active) {
      return;
    }
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const left = Math.max(0, seconds - (performance.now() - startedAt) / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        onExpireRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, seconds]);

  return remaining;
}

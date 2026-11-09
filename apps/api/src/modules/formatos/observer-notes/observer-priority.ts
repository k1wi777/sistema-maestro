export interface PageSlice {
  skip: number;
  take: number;
}

/**
 * Reparte una página de `skip`/`take` entre dos segmentos consecutivos (el prioritario, de
 * `priorityCount` filas, y el resto): cada uno recibe su propio `skip`/`take`. Los bordes
 * (página que cruza de un segmento al otro, o que cae entera en uno) quedan sin huecos ni
 * repetidos.
 */
export function splitPriorityWindow(
  skip: number,
  take: number,
  priorityCount: number,
): { priority: PageSlice; rest: PageSlice } {
  const prioritySkip = Math.min(skip, priorityCount);
  const priorityTake = Math.max(0, Math.min(take, priorityCount - skip));
  return {
    priority: { skip: prioritySkip, take: priorityTake },
    rest: { skip: Math.max(0, skip - priorityCount), take: take - priorityTake },
  };
}

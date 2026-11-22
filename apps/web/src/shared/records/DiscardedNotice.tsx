'use client';

import { useQueryParams } from '@/shared/data';
import { Notice } from '@/shared/ui';

/** Parámetro con el que las pantallas de descarte vuelven a la lista (`?aviso=descartado`). */
export const DISCARDED_NOTICE = 'descartado';

/** Aviso de la lista tras descartar un borrador. */
export function DiscardedNotice() {
  const { params } = useQueryParams();
  return params.get('aviso') === DISCARDED_NOTICE ? (
    <Notice tone="success">Borrador descartado.</Notice>
  ) : null;
}

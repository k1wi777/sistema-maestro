import { SharedActivityType } from '@gns/shared';

import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_OPTIONS } from './activity-types';

describe('activity types', () => {
  it('labels every type of the contract in Spanish', () => {
    expect(ACTIVITY_TYPE_OPTIONS.map((option) => option.value)).toEqual(
      Object.values(SharedActivityType),
    );
    expect(ACTIVITY_TYPE_LABELS.recurso_digital).toBe('Recurso digital');
    expect(ACTIVITY_TYPE_LABELS.juego).toBe('Juego');
  });
});

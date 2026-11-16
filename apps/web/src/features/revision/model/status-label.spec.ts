import { RecordStatus } from '@gns/shared';

import { shortStatusLabel } from './status-label';

describe('shortStatusLabel', () => {
  it('tiene una etiqueta corta para cada estado', () => {
    for (const status of Object.values(RecordStatus)) {
      expect(shortStatusLabel(status).length).toBeGreaterThan(0);
      expect(shortStatusLabel(status).length).toBeLessThanOrEqual(21);
    }
    expect(shortStatusLabel(RecordStatus.Submitted)).toBe('Pendiente de revisión');
  });
});

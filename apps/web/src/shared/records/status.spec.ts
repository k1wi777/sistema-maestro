import { RecordStatus } from '@gns/shared';

import { STATUS_INFO, STATUS_ORDER, canDiscard, canVoid, isEditable } from './status';

describe('status', () => {
  it('describes every status exactly once', () => {
    expect(new Set(STATUS_ORDER)).toEqual(new Set(Object.values(RecordStatus)));
    expect(Object.keys(STATUS_INFO).sort()).toEqual([...STATUS_ORDER].sort());
  });

  it('uses the tone of each status', () => {
    expect(STATUS_INFO.borrador.tone).toBe('neutral');
    expect(STATUS_INFO.enviada.tone).toBe('info');
    expect(STATUS_INFO.observaciones.tone).toBe('warning');
    expect(STATUS_INFO.revisada.tone).toBe('success');
    expect(STATUS_INFO.anulado.tone).toBe('danger');
  });

  it('lets the owner edit only drafts and records with observations', () => {
    expect(STATUS_ORDER.filter(isEditable)).toEqual(['borrador', 'observaciones']);
  });

  it('lets the owner void only submitted records and records with observations', () => {
    expect(STATUS_ORDER.filter(canVoid)).toEqual(['enviada', 'observaciones']);
  });

  it('lets the owner discard only drafts', () => {
    expect(STATUS_ORDER.filter(canDiscard)).toEqual(['borrador']);
  });
});

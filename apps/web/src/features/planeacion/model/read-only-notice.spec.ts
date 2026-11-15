import { readOnlyNotice } from './read-only-notice';

describe('read-only notice', () => {
  it('explains the read-only states only', () => {
    expect(readOnlyNotice('borrador')).toBeNull();
    expect(readOnlyNotice('observaciones')).toBeNull();
    expect(readOnlyNotice('enviada')?.text).toContain('coordinación la está revisando');
    expect(readOnlyNotice('revisada')).not.toBeNull();
    expect(readOnlyNotice('anulado')).not.toBeNull();
  });
});

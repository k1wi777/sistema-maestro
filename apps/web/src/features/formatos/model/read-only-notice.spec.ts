import { readOnlyNotice } from './read-only-notice';

describe('read-only notice', () => {
  it('explains only the read-only states', () => {
    expect(readOnlyNotice('borrador', 'hoja')).toBeNull();
    expect(readOnlyNotice('observaciones', 'anotación')).toBeNull();
    expect(readOnlyNotice('enviada', 'hoja')?.text).toContain('coordinación la está revisando');
    expect(readOnlyNotice('revisada', 'anotación')?.text).toContain('esta anotación');
    expect(readOnlyNotice('anulado', 'hoja')?.tone).toBe('warning');
  });
});

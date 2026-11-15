import { adjustedNoteFields } from './observer-feedback';

describe('observer feedback', () => {
  it('translates the adjusted columns and ignores unknown ones', () => {
    expect(
      adjustedNoteFields({ adjustedColumns: ['seguimiento', 'columna_desconocida', 'tipo'] }),
    ).toEqual(['Seguimiento', 'Tipo de anotación']);
    expect(adjustedNoteFields({ adjustedColumns: [] })).toEqual([]);
  });
});

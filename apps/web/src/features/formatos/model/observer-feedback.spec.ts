import { adjustedNoteFields } from './observer-feedback';

describe('observer feedback', () => {
  it('translates the adjusted columns and ignores unknown ones', () => {
    expect(
      adjustedNoteFields({ adjustedColumns: ['seguimiento', 'columna_desconocida', 'tipo'] }),
    ).toEqual(['Seguimiento', 'Tipo de anotación']);
    expect(adjustedNoteFields({ adjustedColumns: [] })).toEqual([]);
  });

  it('uses the renamed labels and the new strategies block', () => {
    expect(
      adjustedNoteFields({
        adjustedColumns: ['descripcion', 'estrategias_pedagogicas', 'acciones'],
      }),
    ).toEqual(['Comportamiento específico', 'Estrategias pedagógicas', 'Resultados y compromisos']);
  });
});

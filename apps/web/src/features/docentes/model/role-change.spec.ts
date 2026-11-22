import { deactivationWarning, roleChangeConsequences } from './role-change';

const base = { name: 'Daniela Fontalba', groups: [], coordinatedGrades: [] };

describe('roleChangeConsequences', () => {
  it('de docente a coordinación avisa de las asignaciones y la dirección de grupo', () => {
    const lines = roleChangeConsequences({
      ...base,
      from: 'docente',
      to: 'coordinador',
      groups: [
        { name: 'Transition 2', isHomeroom: true },
        { name: 'Kinder 1', isHomeroom: false },
      ],
    });

    expect(lines[0]).toBe(
      'Daniela Fontalba deja de ser docente: se retiran sus asignaciones en Transition 2 y Kinder 1 y deja de ser director(a) de Transition 2, que quedará sin director(a).',
    );
    expect(lines).toContain('Asígnale grados en Grados y áreas para que pueda revisar.');
    expect(lines).toContain('Sus registros se conservan.');
    expect(lines.at(-1)).toContain('sesiones');
  });

  it('de docente sin asignaciones lo dice sin inventar grupos', () => {
    expect(roleChangeConsequences({ ...base, from: 'docente', to: 'administrador' })[0]).toBe(
      'Daniela Fontalba deja de ser docente: no tiene asignaciones activas en el año vigente.',
    );
  });

  it('de coordinación a otro rol avisa de los grados sin coordinadora', () => {
    const [first] = roleChangeConsequences({
      ...base,
      from: 'coordinador',
      to: 'docente',
      coordinatedGrades: ['Red', 'Blue'],
    });
    expect(first).toContain('Red y Blue quedarán sin coordinadora');
    const [single] = roleChangeConsequences({
      ...base,
      from: 'coordinador',
      to: 'administrador',
      coordinatedGrades: ['Red'],
    });
    expect(single).toContain('Red quedará sin coordinadora');
  });

  it('de administración a otro rol solo conserva los registros y cierra sesiones', () => {
    expect(roleChangeConsequences({ ...base, from: 'administrador', to: 'docente' })).toEqual([
      'Sus registros se conservan.',
      'Sus sesiones abiertas se cerrarán y deberá ingresar de nuevo.',
    ]);
  });
});

describe('deactivationWarning', () => {
  it('avisa de los grados sin revisión o calla si no hay grados', () => {
    expect(deactivationWarning(['Red', 'Blue', 'Green'])).toBe(
      'Red, Blue y Green no tendrán quién revise mientras esté inactiva.',
    );
    expect(deactivationWarning([])).toBeNull();
  });
});

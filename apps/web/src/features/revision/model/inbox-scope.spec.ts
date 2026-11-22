import {
  COLLEGE_VIEW,
  coordinatorFilter,
  noGradesMessage,
  resolveScope,
  vistaParam,
} from './inbox-scope';

describe('resolveScope', () => {
  it('coordinación con grados empieza en «Mis grados» y pasa a todo el colegio con vista=colegio', () => {
    expect(resolveScope(true, true, null)).toBe('mine');
    expect(resolveScope(true, true, 'otra')).toBe('mine');
    expect(resolveScope(true, true, COLLEGE_VIEW)).toBe('all');
  });

  it('sin grados asignados, coordinación solo consulta todo el colegio', () => {
    expect(resolveScope(true, false, null)).toBe('all');
  });

  it('administración siempre ve todo el colegio', () => {
    expect(resolveScope(false, false, null)).toBe('all');
    expect(resolveScope(false, true, null)).toBe('all');
  });
});

describe('vistaParam', () => {
  it('solo «Todo el colegio» deja rastro en la URL', () => {
    expect(vistaParam('mine')).toBeNull();
    expect(vistaParam('all')).toBe('colegio');
  });
});

describe('coordinatorFilter', () => {
  it('en «Mis grados» filtra por la propia coordinadora', () => {
    expect(coordinatorFilter('mine', true, 'c-1', undefined)).toBe('c-1');
  });

  it('en «Todo el colegio» coordinación no filtra', () => {
    expect(coordinatorFilter('all', true, 'c-1', 'c-2')).toBeUndefined();
  });

  it('administración usa el filtro que elige (incluido «none»)', () => {
    expect(coordinatorFilter('all', false, 'a-1', 'c-2')).toBe('c-2');
    expect(coordinatorFilter('all', false, 'a-1', 'none')).toBe('none');
    expect(coordinatorFilter('all', false, 'a-1', undefined)).toBeUndefined();
  });
});

describe('noGradesMessage', () => {
  it('explica que solo puede consultar y a quién pedirle los grados', () => {
    expect(noGradesMessage('los diarios')).toBe(
      'Aún no tienes grados asignados: puedes consultar los diarios de todo el colegio, pero no revisarlos. Pídele a administración que te los asigne en Grados y áreas.',
    );
  });
});

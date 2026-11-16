import { UNKNOWN_USER_LABEL, buildUserOptions } from './user-options';

const A = { id: 'a', name: 'Laura Demo' };
const B = { id: 'b', name: 'Andrés Demo' };

describe('buildUserOptions', () => {
  it('une docentes y usuarios de los movimientos sin duplicados y por nombre', () => {
    const options = buildUserOptions([A], [B, A, null]);
    expect(options).toEqual([
      { value: 'b', label: 'Andrés Demo' },
      { value: 'a', label: 'Laura Demo' },
    ]);
  });

  it('ofrece «Usuario seleccionado» si el elegido aún no tiene nombre', () => {
    expect(buildUserOptions([], [], 'z')).toEqual([{ value: 'z', label: UNKNOWN_USER_LABEL }]);
  });

  it('usa el nombre conocido del usuario elegido', () => {
    expect(buildUserOptions([A], [], 'a')).toEqual([{ value: 'a', label: 'Laura Demo' }]);
  });
});

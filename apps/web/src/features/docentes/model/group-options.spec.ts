import { areasForLevel, groupOptions } from './group-options';

const levels = [
  { id: 'l-1', name: 'Preescolar alto (KTF)' },
  { id: 'l-2', name: 'Primaria' },
];
const grades = [
  { id: 'g-1', name: 'Kinder', levelId: 'l-1', sortOrder: 1, active: true },
  { id: 'g-2', name: '2°', levelId: 'l-2', sortOrder: 2, active: true },
  { id: 'g-3', name: '3°', levelId: 'l-2', sortOrder: 3, active: false },
];

describe('groupOptions', () => {
  it('ordena por grado y número de grupo, rotula con el nivel y omite grados inactivos', () => {
    const options = groupOptions(
      [
        { id: 'a', name: 'Kinder 10', gradeId: 'g-1' },
        { id: 'b', name: 'Kinder 2', gradeId: 'g-1' },
        { id: 'c', name: '2° 1', gradeId: 'g-2' },
        { id: 'd', name: '3° 1', gradeId: 'g-3' },
      ],
      grades,
      levels,
    );

    expect(options.map((option) => option.label)).toEqual([
      'Kinder 2 · Preescolar alto (KTF)',
      'Kinder 10 · Preescolar alto (KTF)',
      '2° 1 · Primaria',
    ]);
    expect(options[2]?.levelId).toBe('l-2');
  });
});

describe('areasForLevel', () => {
  it('ofrece solo las áreas activas del nivel del grupo', () => {
    const areas = [
      {
        id: 'a',
        name: 'Math',
        type: 'asignatura' as const,
        active: true,
        levelIds: ['l-1', 'l-2'],
      },
      { id: 'b', name: 'Física', type: 'asignatura' as const, active: true, levelIds: ['l-2'] },
      { id: 'c', name: 'Danza', type: 'asignatura' as const, active: false, levelIds: ['l-1'] },
    ];

    expect(areasForLevel(areas, 'l-1').map((area) => area.id)).toEqual(['a']);
    expect(areasForLevel(areas, 'l-2').map((area) => area.id)).toEqual(['a', 'b']);
  });
});

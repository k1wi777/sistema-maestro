import { countPages, toPageWindow } from './prisma-read.repository';

describe('paginación de la base', () => {
  it('calcula skip y take', () => {
    expect(toPageWindow(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(toPageWindow(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('calcula el total de páginas', () => {
    expect(countPages(0, 20)).toBe(0);
    expect(countPages(20, 20)).toBe(1);
    expect(countPages(21, 20)).toBe(2);
  });
});

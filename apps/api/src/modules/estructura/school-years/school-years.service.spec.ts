import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SchoolYear } from '@gns/shared';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { SchoolYearRepository } from './school-year.repository';
import { NO_CURRENT_SCHOOL_YEAR_MESSAGE, SchoolYearsService } from './school-years.service';

const NOW = new Date('2026-11-09T00:00:00Z');
const year = (code: string, isCurrent = false): SchoolYear => ({
  id: `id-${code}`,
  code,
  isCurrent,
  createdAt: NOW,
  updatedAt: NOW,
});

function setup(years: SchoolYear[], periods: Record<string, number> = {}) {
  const repository = {
    findById: jest.fn((id: string) => Promise.resolve(years.find((y) => y.id === id) ?? null)),
    findByCode: jest.fn((code: string) =>
      Promise.resolve(years.find((y) => y.code === code) ?? null),
    ),
    findCurrent: jest.fn(() => Promise.resolve(years.find((y) => y.isCurrent) ?? null)),
    countPeriods: jest.fn((code: string) => Promise.resolve(periods[code] ?? 0)),
    create: jest.fn((input: { code: string }) => Promise.resolve(year(input.code))),
    markCurrent: jest.fn((id: string) => Promise.resolve({ ...year(id), isCurrent: true })),
    findPage: jest.fn(),
  } satisfies SchoolYearRepository;
  const transactions: TransactionRunner = { run: (fn) => fn() };
  return { service: new SchoolYearsService(repository, transactions), repository };
}

describe('SchoolYearsService', () => {
  it('requireCurrent devuelve el vigente', async () => {
    const { service } = setup([year('2025-2026'), year('2026-2027', true)]);

    await expect(service.requireCurrent()).resolves.toMatchObject({ code: '2026-2027' });
  });

  it('requireCurrent responde 409 con un mensaje claro si no hay vigente', async () => {
    const { service } = setup([year('2026-2027')]);

    const error = await service.requireCurrent().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(NO_CURRENT_SCHOOL_YEAR_MESSAGE);
  });

  it('registra un año nuevo y rechaza un código repetido', async () => {
    const { service, repository } = setup([year('2026-2027')]);

    await service.create({ code: '2027-2028' });
    expect(repository.create).toHaveBeenCalledWith({ code: '2027-2028' });
    await expect(service.create({ code: '2026-2027' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('marca como vigente un año con sus 3 periodos', async () => {
    const { service, repository } = setup([year('2026-2027', true), year('2027-2028')], {
      '2027-2028': 3,
    });

    await expect(service.setCurrent('id-2027-2028')).resolves.toMatchObject({ isCurrent: true });
    expect(repository.markCurrent).toHaveBeenCalledWith('id-2027-2028');
  });

  it('rechaza con 409 un año sin sus 3 periodos y no cambia el vigente', async () => {
    const { service, repository } = setup([year('2026-2027', true), year('2027-2028')], {
      '2027-2028': 2,
    });

    await expect(service.setCurrent('id-2027-2028')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.markCurrent).not.toHaveBeenCalled();
  });

  it('es idempotente con el año que ya es vigente', async () => {
    const { service, repository } = setup([year('2026-2027', true)]);

    await expect(service.setCurrent('id-2026-2027')).resolves.toMatchObject({ isCurrent: true });
    expect(repository.markCurrent).not.toHaveBeenCalled();
  });

  it('responde 404 si el año no existe', async () => {
    const { service } = setup([]);

    await expect(service.setCurrent('nada')).rejects.toBeInstanceOf(NotFoundException);
  });
});

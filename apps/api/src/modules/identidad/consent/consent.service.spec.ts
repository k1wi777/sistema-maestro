import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DATA_CONSENT_ITEMS, type DataConsent } from '@gns/shared';
import type { Env } from '../../../core/config/env.validation';
import type { ConsentRecord, ConsentRepository, NewConsent } from './consent.repository';
import { ConsentService } from './consent.service';

const VERSION = '2026-1';
const INPUT = {
  policyVersion: VERSION,
  items: { policy: true, authorization: true, minors: true, security: true },
} as const;

function setup(existing: ConsentRecord | null = null) {
  const create = jest.fn<Promise<ConsentRecord>, [NewConsent]>((input) =>
    Promise.resolve({
      id: 'c-1',
      userId: input.userId,
      policyVersion: input.policyVersion,
      acceptedAt: input.acceptedAt,
      items: input.items as DataConsent['items'],
    }),
  );
  const repository: ConsentRepository = {
    findById: jest.fn<Promise<ConsentRecord | null>, [string]>(() => Promise.resolve(existing)),
    find: jest.fn<Promise<ConsentRecord | null>, [string, string]>(() => Promise.resolve(existing)),
    create,
  };
  const config = { get: () => VERSION } as unknown as ConfigService<Env, true>;
  return { service: new ConsentService(repository, config), create };
}

describe('ConsentService', () => {
  it('reports the current version as not accepted', async () => {
    const { service } = setup();

    await expect(service.status('u-1')).resolves.toEqual({
      policyVersion: VERSION,
      accepted: false,
      acceptedAt: null,
    });
    await expect(service.hasAcceptedCurrent('u-1')).resolves.toBe(false);
  });

  it('reports the acceptance date once accepted', async () => {
    const acceptedAt = new Date('2026-11-09T10:00:00Z');
    const { service } = setup({
      id: 'c-1',
      userId: 'u-1',
      policyVersion: VERSION,
      acceptedAt,
      items: [],
    });

    await expect(service.status('u-1')).resolves.toEqual({
      policyVersion: VERSION,
      accepted: true,
      acceptedAt,
    });
  });

  it('records the four boxes with the server date', async () => {
    const { service, create } = setup();
    const before = Date.now();

    const result = await service.accept('u-1', INPUT);

    expect(create).toHaveBeenCalledTimes(1);
    const saved = create.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ userId: 'u-1', policyVersion: VERSION });
    expect(saved?.items).toEqual([...DATA_CONSENT_ITEMS]);
    expect(saved?.acceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.items).toEqual([...DATA_CONSENT_ITEMS]);
  });

  it('answers 409 and records nothing for a version that is not the current one', async () => {
    const { service, create } = setup();

    await expect(service.accept('u-1', { ...INPUT, policyVersion: 'vieja' })).rejects.toThrow(
      ConflictException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 409 and records nothing when the current version was already accepted', async () => {
    const { service, create } = setup({
      id: 'c-1',
      userId: 'u-1',
      policyVersion: VERSION,
      acceptedAt: new Date(),
      items: [],
    });

    await expect(service.accept('u-1', INPUT)).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });
});

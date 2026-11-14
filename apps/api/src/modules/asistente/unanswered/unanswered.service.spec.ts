import { NotFoundException } from '@nestjs/common';
import { ApiErrorCode, type UnansweredQuestion } from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { UnansweredRepository } from './unanswered.repository';
import { displayText, normalizeQuestionText, UnansweredService } from './unanswered.service';

const NOW = new Date('2026-11-14T10:00:00Z');
const group = (status: UnansweredQuestion['status'] = 'pendiente'): UnansweredQuestion => ({
  id: 'g1',
  text: status === 'pendiente' ? 'Texto' : null,
  times: 1,
  firstAskedAt: NOW,
  lastAskedAt: NOW,
  status,
  faqId: null,
  closedAt: null,
  occurrences: [],
});

function setup(existing: UnansweredQuestion | null, closes = true) {
  const repository = {
    findById: jest.fn(() => Promise.resolve(existing)),
    findGroup: jest.fn(() => Promise.resolve(existing)),
    findPage: jest.fn(),
    recordOccurrence: jest.fn(() => Promise.resolve('g1')),
    close: jest.fn(() => Promise.resolve(closes)),
  } satisfies UnansweredRepository;
  const transactions: TransactionRunner = { run: (fn) => fn() };
  return { service: new UnansweredService(repository, transactions), repository };
}

describe('normalizeQuestionText', () => {
  it('folds tildes, case and punctuation and collapses spaces', () => {
    expect(normalizeQuestionText('¿Qué  hago   con el NIÑO que llegó tarde?')).toBe(
      'que hago con el nino que llego tarde',
    );
  });

  it('gives the same key to the variants of a question', () => {
    expect(normalizeQuestionText('Un niño llegó tárde!')).toBe(
      normalizeQuestionText('  un NINO llego tarde '),
    );
  });
});

describe('displayText', () => {
  it('trims and collapses whitespace but keeps the writing', () => {
    expect(displayText('  ¿Cómo   está   Ana?  ')).toBe('¿Cómo está Ana?');
  });
});

describe('UnansweredService.register', () => {
  it('records the display text, the normalized key and the author', async () => {
    const { service, repository } = setup(null);

    await expect(service.register('u1', '  ¿Dónde   está la LLAVE?')).resolves.toBe('g1');

    expect(repository.recordOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '¿Dónde está la LLAVE?',
        normalizedText: 'donde esta la llave',
        userId: 'u1',
      }),
    );
  });
});

describe('UnansweredService.attend and discard', () => {
  it('closes a pending question as attended and links the FAQ', async () => {
    const { service, repository } = setup(group());

    await service.attend('u1', 'g1', 'faq1');

    expect(repository.close).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ status: 'atendida', closedById: 'u1', faqId: 'faq1' }),
    );
  });

  it('closes as discarded without a FAQ and returns the question', async () => {
    const { service, repository } = setup(group());

    await expect(service.discard('u1', 'g1')).resolves.toMatchObject({ id: 'g1' });

    expect(repository.close).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ status: 'descartada', faqId: null }),
    );
  });

  it('responds 404 when the question does not exist', async () => {
    const { service } = setup(null, false);

    await expect(service.attend('u1', 'g1', 'faq1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.discard('u1', 'g1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responds 409 with its own code when it is no longer pending', async () => {
    const { service } = setup(group('descartada'), false);

    const error = await service.discard('u1', 'g1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiCodedException);
    expect(error).toMatchObject({ code: ApiErrorCode.UnansweredQuestionClosed });
    expect((error as ApiCodedException).getStatus()).toBe(409);
  });
});

describe('UnansweredService.get', () => {
  it('responds 404 for an unknown id', async () => {
    const { service } = setup(null);

    await expect(service.get('nada')).rejects.toBeInstanceOf(NotFoundException);
  });
});

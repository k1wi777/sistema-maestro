import { ConflictException, NotFoundException } from '@nestjs/common';
import type { FaqAdminView } from '@gns/shared';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { UnansweredService } from '../unanswered/unanswered.service';
import type { FaqsRepository } from './faqs.repository';
import { FaqsService } from './faqs.service';

const NOW = new Date('2026-11-14T10:00:00Z');
const faq = (id = 'f1'): FaqAdminView => ({
  id,
  category: 'Convivencia',
  question: 'Pregunta',
  answer: 'Respuesta',
  source: null,
  keywords: null,
  isActive: true,
  updatedById: 'u1',
  createdAt: NOW,
  updatedAt: NOW,
});

function setup(
  existing: FaqAdminView | null,
  attend: () => Promise<void> = () => Promise.resolve(),
) {
  const repository = {
    findById: jest.fn(() => Promise.resolve(existing)),
    findPage: jest.fn(),
    findActive: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve(faq('new'))),
    update: jest.fn(() => Promise.resolve(faq())),
  } satisfies FaqsRepository;
  const attendMock = jest.fn(attend);
  const unanswered = { attend: attendMock } as unknown as UnansweredService;
  const transactions: TransactionRunner = { run: (fn) => fn() };
  return { service: new FaqsService(repository, transactions, unanswered), repository, attendMock };
}

const input = {
  category: 'Convivencia' as const,
  question: 'Pregunta',
  answer: 'Respuesta',
  isActive: true,
};

describe('FaqsService.create', () => {
  it('creates the question without touching the unanswered ones', async () => {
    const { service, repository, attendMock } = setup(null);

    await expect(service.create('u1', input)).resolves.toMatchObject({ id: 'new' });

    expect(repository.create).toHaveBeenCalledWith(input, 'u1');
    expect(attendMock).not.toHaveBeenCalled();
  });

  it('closes the linked unanswered question as attended with the new FAQ', async () => {
    const { service, attendMock } = setup(null);

    await service.create('u1', { ...input, unansweredQuestionId: 'g1' });

    expect(attendMock).toHaveBeenCalledWith('u1', 'g1', 'new');
  });

  it('propagates the 409 of a question that is not pending', async () => {
    const { service } = setup(null, () => Promise.reject(new ConflictException('cerrada')));

    await expect(
      service.create('u1', { ...input, unansweredQuestionId: 'g1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('FaqsService.update and get', () => {
  it('updates only the fields received and records the editor', async () => {
    const { service, repository } = setup(faq());

    await service.update('u2', 'f1', { isActive: false });

    expect(repository.update).toHaveBeenCalledWith('f1', { isActive: false }, 'u2');
  });

  it('responds 404 for an unknown question', async () => {
    const { service, repository } = setup(null);

    await expect(service.update('u2', 'f1', { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.get('f1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('lists the active questions without any author data', async () => {
    const { service } = setup(null);

    await expect(service.listActive()).resolves.toEqual({ items: [] });
  });
});

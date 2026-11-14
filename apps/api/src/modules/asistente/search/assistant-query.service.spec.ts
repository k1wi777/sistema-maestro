import type { RequestUser } from '../../../core/audit/request-user';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { UnansweredService } from '../unanswered/unanswered.service';
import type { AssistantQueryLog } from './assistant-query-log';
import { AssistantQueryService } from './assistant-query.service';
import type { AssistantSearchService, SearchOutcome } from './assistant-search.service';

const user = { id: 'u1', role: 'docente', sessionId: 's1' } as RequestUser;

function setup(outcome: SearchOutcome) {
  const search = {
    search: jest.fn(() => Promise.resolve(outcome)),
  } as unknown as AssistantSearchService;
  const register = jest.fn(() => Promise.resolve('g1'));
  const answered = jest.fn(() => Promise.resolve());
  const unansweredLog = jest.fn(() => Promise.resolve());
  const run = jest.fn((fn: () => Promise<unknown>) => fn());
  const unanswered = { register } as unknown as UnansweredService;
  const log = { answered, unanswered: unansweredLog } as unknown as AssistantQueryLog;
  const transactions = { run } as unknown as TransactionRunner;
  return {
    service: new AssistantQueryService(search, unanswered, log, transactions),
    register,
    answered,
    unansweredLog,
    run,
  };
}

const faq = { id: 'f1', category: 'Convivencia', question: 'P', answer: 'R', source: null };

describe('AssistantQueryService.ask', () => {
  it('logs an answered query with the FAQ id and registers nothing', async () => {
    const { service, register, answered } = setup({ status: 'answered', faq, related: [] });

    await expect(service.ask(user, 'pregunta')).resolves.toEqual({
      status: 'answered',
      faq,
      related: [],
    });

    expect(answered).toHaveBeenCalledWith(user, 'f1');
    expect(register).not.toHaveBeenCalled();
  });

  it('registers an unanswered question and logs it linked to its group in one transaction', async () => {
    const { service, register, unansweredLog, run } = setup({
      status: 'unanswered',
      suggestions: [],
      registrable: true,
    });

    await expect(service.ask(user, 'algo raro')).resolves.toEqual({
      status: 'unanswered',
      suggestions: [],
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('u1', 'algo raro');
    expect(unansweredLog).toHaveBeenCalledWith(user, 'g1');
  });

  it('logs without registering a question that has no significant words', async () => {
    const { service, register, unansweredLog } = setup({
      status: 'unanswered',
      suggestions: [],
      registrable: false,
    });

    await service.ask(user, 'hola');

    expect(register).not.toHaveBeenCalled();
    expect(unansweredLog).toHaveBeenCalledWith(user, null);
  });
});

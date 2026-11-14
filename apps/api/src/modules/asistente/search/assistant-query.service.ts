import { Inject, Injectable } from '@nestjs/common';
import type { AssistantAnswer } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { UnansweredService } from '../unanswered/unanswered.service';
import { AssistantQueryLog } from './assistant-query-log';
import { AssistantSearchService } from './assistant-search.service';

/** Una consulta al asistente: busca, y si no hay respuesta la registra y deja constancia (R8 a R13, R18). */
@Injectable()
export class AssistantQueryService {
  constructor(
    private readonly search: AssistantSearchService,
    private readonly unanswered: UnansweredService,
    private readonly log: AssistantQueryLog,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
  ) {}

  async ask(user: RequestUser, question: string): Promise<AssistantAnswer> {
    const outcome = await this.search.search(question);
    if (outcome.status === 'answered') {
      await this.log.answered(user, outcome.faq.id);
      return { status: 'answered', faq: outcome.faq, related: outcome.related };
    }
    // Grupo, ocurrencia y fila de bitácora van en una sola transacción.
    await this.transactions.run(async () => {
      const unansweredId = outcome.registrable
        ? await this.unanswered.register(user.id, question)
        : null;
      await this.log.unanswered(user, unansweredId);
    });
    return { status: 'unanswered', suggestions: outcome.suggestions };
  }
}

import {
  challengeAnswerResultSchema,
  challengeStepSchema,
  type ChallengeAnswerBody,
  type ChallengeAnswerResult,
  type ChallengeStep,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Empieza el Desafío o lo reinicia: una partida vieja se sobrescribe. */
export async function startChallenge(moduleId: string): Promise<ApiResult<ChallengeStep>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/challenge', { params: { path: { moduleId } } }),
  );
  return parseResult(result, challengeStepSchema);
}

/** Envía la respuesta (o `null` por tiempo agotado); la API la califica. */
export async function answerChallenge(
  moduleId: string,
  body: ChallengeAnswerBody,
): Promise<ApiResult<ChallengeAnswerResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/challenge/answer', {
      params: { path: { moduleId } },
      body,
    }),
  );
  return parseResult(result, challengeAnswerResultSchema);
}

export async function nextChallengeStep(moduleId: string): Promise<ApiResult<ChallengeStep>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/challenge/next', {
      params: { path: { moduleId } },
    }),
  );
  return parseResult(result, challengeStepSchema);
}

import {
  activityGameAnswerResultSchema,
  activityGameStepSchema,
  simulatorUseResultSchema,
  wheelStampResultSchema,
  type ActivityGameAnswerBody,
  type ActivityGameAnswerResult,
  type ActivityGameStep,
  type SimulatorUseResult,
  type WheelStampBody,
  type WheelStampResult,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Responde una tarjeta de la ruleta; la API califica y concede el sello. */
export async function stampWheelCard(
  activityId: string,
  body: WheelStampBody,
): Promise<ApiResult<WheelStampResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/activities/{activityId}/stamps', {
      params: { path: { activityId } },
      body,
    }),
  );
  return parseResult(result, wheelStampResultSchema);
}

/** Registra el uso de un simulador; el cuerpo va vacío: los valores nunca salen del navegador. */
export async function markSimulatorUsed(
  activityId: string,
): Promise<ApiResult<SimulatorUseResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/activities/{activityId}/use', {
      params: { path: { activityId } },
      body: {},
    }),
  );
  return parseResult(result, simulatorUseResultSchema);
}

/** Empieza una partida de Conecta o ¿Verdad o mito?; una anterior se sobrescribe. */
export async function startActivityGame(activityId: string): Promise<ApiResult<ActivityGameStep>> {
  const result = await callApi(() =>
    api.POST('/me/training/activities/{activityId}/game', {
      params: { path: { activityId } },
    }),
  );
  return parseResult(result, activityGameStepSchema);
}

export async function answerActivityGame(
  activityId: string,
  body: ActivityGameAnswerBody,
): Promise<ApiResult<ActivityGameAnswerResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/activities/{activityId}/game/answer', {
      params: { path: { activityId } },
      body,
    }),
  );
  return parseResult(result, activityGameAnswerResultSchema);
}

export async function nextActivityGameStep(
  activityId: string,
): Promise<ApiResult<ActivityGameStep>> {
  const result = await callApi(() =>
    api.POST('/me/training/activities/{activityId}/game/next', {
      params: { path: { activityId } },
    }),
  );
  return parseResult(result, activityGameStepSchema);
}

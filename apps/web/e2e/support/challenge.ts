import { expect, type Page } from '@playwright/test';
import { ChallengeQuestionType } from '@gns/shared';
import { INDUCTION_MODULES } from '../../../api/prisma/seed/initial/induction.data.ts';

/**
 * Juega el Desafío GNS de un módulo por la interfaz, respondiendo bien cada pregunta. Las
 * respuestas salen de los datos iniciales (la suite no las lee de la API) y la pregunta en
 * pantalla se identifica por su enunciado, porque el orden es aleatorio.
 */
export async function playChallengeToTheEnd(page: Page, moduleNumber: string): Promise<void> {
  const questions = INDUCTION_MODULES.find((module) => module.number === moduleNumber)?.questions;
  if (!questions?.length) {
    throw new Error(`El módulo ${moduleNumber} no tiene preguntas del Desafío en los datos.`);
  }
  const game = page.getByRole('group', { name: 'Desafío GNS' });
  await game.getByRole('button', { name: 'Jugar' }).click();

  for (let position = 1; position <= questions.length; position += 1) {
    await expect(game.getByText(`${position} / ${questions.length}`)).toBeVisible();
    let current: (typeof questions)[number] | undefined;
    await expect
      .poll(async () => {
        for (const question of questions) {
          if (await game.getByText(question.prompt, { exact: true }).isVisible()) {
            current = question;
            return true;
          }
        }
        return false;
      })
      .toBe(true);
    if (!current) {
      throw new Error('No se reconoció la pregunta en pantalla.');
    }

    if (current.type === ChallengeQuestionType.TrueFalse) {
      await game
        .getByRole('button', { name: current.trueFalseAnswer ? 'Verdadero' : 'Falso' })
        .click();
    } else if (current.type === ChallengeQuestionType.MultipleChoice) {
      const correct = current.options?.find((option) => option.isCorrect);
      await game.getByRole('button', { name: correct?.text ?? '', exact: true }).click();
    } else {
      // Ordenar: los pasos se pulsan en el orden correcto, que es el de los datos.
      for (const option of current.options ?? []) {
        await game.getByRole('button', { name: option.text, exact: true }).click();
      }
      await game.getByRole('button', { name: /Confirmar/ }).click();
    }

    await expect(game.getByText('¡Correcto!')).toBeVisible();
    await game.getByRole('button', { name: /Siguiente pregunta|Ver resultado/ }).click();
  }
}

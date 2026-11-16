import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { Actor } from './actors';

export interface ActorPage {
  context: BrowserContext;
  page: Page;
}

/** Abre una página con la sesión que el proyecto `setup` guardó para el actor. */
export async function openAs(browser: Browser, actor: Actor): Promise<ActorPage> {
  const context = await browser.newContext({ storageState: actor.sessionFile });
  return { context, page: await context.newPage() };
}

export default async function globalTeardown(): Promise<void> {
  await globalThis.__GNS_TEST_DB__?.stop();
  globalThis.__GNS_TEST_DB__ = undefined;
}

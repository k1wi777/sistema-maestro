export default async function globalTeardown(): Promise<void> {
  await Promise.all([globalThis.__GNS_TEST_DB__?.stop(), globalThis.__GNS_TEST_STORAGE__?.stop()]);
  globalThis.__GNS_TEST_DB__ = undefined;
  globalThis.__GNS_TEST_STORAGE__ = undefined;
}

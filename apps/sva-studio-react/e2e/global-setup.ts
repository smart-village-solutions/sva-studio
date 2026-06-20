const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForAppRoute = async (): Promise<void> => {
  const configuredPort = process.env.PLAYWRIGHT_PORT ?? '4173';
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${configuredPort}`;
  const readyURL = new URL('/auth/login', baseURL).toString();
  let lastError: unknown;

  for (let attempt = 1; attempt <= 120; attempt += 1) {
    try {
      const response = await fetch(readyURL, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 405) {
        return;
      }
      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[playwright-global-setup] app route readiness failed for ${readyURL}: ${message}`);
};

export default async function globalSetup(): Promise<void> {
  await waitForAppRoute();
}

export type StagehandFetch = typeof fetch;

export interface StagehandReadinessResult {
  readonly checkedUrl: string;
  readonly httpStatus: number;
}

const HTML_REQUEST_INIT = {
  headers: {
    accept: 'text/html,application/xhtml+xml',
  },
  method: 'GET',
  redirect: 'manual',
} as const satisfies RequestInit;

export async function assertStagehandReadiness(
  baseUrl: string,
  fetchImpl: StagehandFetch = fetch
): Promise<StagehandReadinessResult> {
  let response: Response;

  try {
    response = await fetchImpl(baseUrl, HTML_REQUEST_INIT);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown readiness error';
    throw new Error(`Stagehand admin target is not reachable: ${baseUrl}. ${message}`);
  }

  if (response.status === 404) {
    throw new Error(`Stagehand admin target did not expose a usable route at: ${baseUrl} (HTTP 404).`);
  }

  if (response.status >= 500) {
    throw new Error(`Stagehand admin target responded with HTTP ${response.status}: ${baseUrl}`);
  }

  return {
    checkedUrl: baseUrl,
    httpStatus: response.status,
  };
}

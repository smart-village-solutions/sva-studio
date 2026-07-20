import { randomUUID } from 'node:crypto';
import type { StudioMcpConfig } from './config.js';
import { redact } from './redaction.js';
import type { TokenProvider } from './token-provider.js';
import { z } from 'zod';

const jsonResponseSchema = z.json();

export type StudioApiRequest = {
  readonly method?: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly query?: Readonly<Record<string, string | readonly string[] | boolean | undefined>>;
  readonly body?: unknown;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly confirmationChallengeId?: string;
  readonly confirmationPhrase?: string;
  readonly signal?: AbortSignal;
};

export class StudioApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
    readonly requestId: string,
    readonly idempotencyKey?: string
  ) { super(`studio_api_error:${status}`); }
}

export class UpstreamSchemaError extends Error {
  constructor() { super('invalid_upstream_response'); }
}

export type StudioApiClient = { request(input: StudioApiRequest): Promise<unknown> };

const buildStudioUrl = (baseUrl: string, input: StudioApiRequest): URL => {
  const url = new URL(input.path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, raw] of Object.entries(input.query ?? {})) {
    if (raw === undefined) continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) url.searchParams.append(key, String(value));
  }
  return url;
};

const buildHeaders = (input: StudioApiRequest, token: string, requestId: string): Record<string, string> => ({
  accept: 'application/json',
  authorization: `Bearer ${token}`,
  'x-request-id': requestId,
  ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
  ...(input.idempotencyKey ? { 'idempotency-key': input.idempotencyKey } : {}),
  ...(input.confirmationChallengeId ? { 'x-confirmation-challenge-id': input.confirmationChallengeId } : {}),
  ...(input.confirmationPhrase ? { 'x-confirmation-phrase': input.confirmationPhrase } : {}),
});

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new UpstreamSchemaError();
  }
  const validated = jsonResponseSchema.safeParse(payload);
  if (!validated.success) throw new UpstreamSchemaError();
  return validated.data;
};

export const createStudioApiClient = (
  config: Pick<StudioMcpConfig, 'baseUrl' | 'readTimeoutMs' | 'mutationTimeoutMs'>,
  tokens: TokenProvider,
  fetchImpl: typeof fetch = fetch
): StudioApiClient => ({
  async request(input) {
    const requestId = input.requestId ?? randomUUID();
    const url = buildStudioUrl(config.baseUrl, input);
    const execute = async (refresh: boolean): Promise<Response> => {
      const token = await tokens.getToken(refresh);
      const timeoutMs = (input.method ?? 'GET') === 'GET' ? config.readTimeoutMs : config.mutationTimeoutMs;
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      return fetchImpl(url, {
        method: input.method ?? 'GET',
        signal,
        headers: buildHeaders(input, token, requestId),
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      });
    };
    let response = await execute(false);
    if (response.status === 401) response = await execute(true);
    const payload = redact(await parseJsonResponse(response));
    if (!response.ok) throw new StudioApiError(response.status, payload, requestId, input.idempotencyKey);
    return payload;
  },
});

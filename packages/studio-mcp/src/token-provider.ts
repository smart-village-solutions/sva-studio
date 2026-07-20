import type { StudioMcpConfig } from './config.js';

type TokenResponse = { readonly access_token?: unknown; readonly expires_in?: unknown };

export type TokenProvider = { getToken(forceRefresh?: boolean): Promise<string> };

export const createClientCredentialsTokenProvider = (
  config: Pick<StudioMcpConfig, 'tokenUrl' | 'clientId' | 'clientSecret' | 'tokenTimeoutMs'>,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now
): TokenProvider => {
  let cached: { token: string; expiresAt: number } | undefined;
  return {
    async getToken(forceRefresh = false) {
      if (!forceRefresh && cached && cached.expiresAt > now() + 30_000) return cached.token;
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      const response = await fetchImpl(config.tokenUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(config.tokenTimeoutMs),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!response.ok) throw new Error(`service_token_unavailable:${response.status}`);
      const payload = (await response.json()) as TokenResponse;
      if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
        throw new Error('service_token_invalid_response');
      }
      const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 60;
      cached = { token: payload.access_token, expiresAt: now() + expiresIn * 1000 };
      return cached.token;
    },
  };
};

import { ServerResponse } from 'node:http';
import * as oidc from 'openid-client';
import type { PersonalMcpContext } from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';

export const CALLBACK_HOST = '127.0.0.1';
export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = '/callback';
export const LOGIN_TIMEOUT_MS = 5 * 60_000;
export const TOKEN_REFRESH_MARGIN_MS = 30_000;

export const realmFor = (issuer: string): string => {
  const parts = new URL(issuer).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
};

export const callbackUri = (port: number): string => `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`;

export const writeCallbackPage = (response: ServerResponse, status: number, message: string): void => {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  response.end(`<!doctype html><meta charset="utf-8"><title>SVA Studio MCP</title><p>${message}</p>`);
};

export const isLoopback = (address: string | undefined): boolean =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';

export const assertIssuerEndpoints = (context: PersonalMcpContext, configuration: oidc.Configuration): void => {
  const issuer = new URL(context.issuer);
  const metadata = configuration.serverMetadata();
  if (metadata.issuer !== context.issuer.replace(/\/$/u, '')) throw new PersonalMcpAuthError('oidc_provider_unavailable');
  for (const endpoint of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.userinfo_endpoint, metadata.revocation_endpoint, metadata.jwks_uri]) {
    if (!endpoint) continue;
    const url = new URL(endpoint);
    if (url.origin !== issuer.origin || url.protocol !== issuer.protocol) {
      throw new PersonalMcpAuthError('oidc_provider_unavailable');
    }
  }
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.userinfo_endpoint) {
    throw new PersonalMcpAuthError('oidc_provider_unavailable');
  }
};

export const discoverConfiguration = async (
  context: PersonalMcpContext,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<oidc.Configuration> => {
  const issuer = new URL(context.issuer);
  const configuration = await oidc.discovery(issuer, context.clientId, undefined, undefined, {
    [oidc.customFetch]: async (input, init) => {
      const url = new URL(input.toString());
      if (url.origin !== issuer.origin || url.protocol !== issuer.protocol) {
        throw new PersonalMcpAuthError('oidc_provider_unavailable');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      return fetchImpl(
        input as unknown as Parameters<typeof fetchImpl>[0],
        { ...init, signal, redirect: 'error' } as unknown as RequestInit
      );
    },
  });
  assertIssuerEndpoints(context, configuration);
  return configuration;
};

import { createHash, randomUUID } from 'node:crypto';

export const SSF_SESSION_REVOCATION_PATH =
  '/internal/control-plane/v1/session-revocations' as const;
export const SSF_CONTROL_PLANE_CLIENT_ID = 'sva-studio-ssf-control-plane' as const;
export const SSF_CONTROL_PLANE_ENV = {
  baseUrl: 'SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL',
  tokenUrl: 'SVA_STUDIO_SSF_CONTROL_PLANE_TOKEN_URL',
  clientId: 'SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_ID',
  clientSecret: 'SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET',
} as const;

const INSTANCE_ID_PATTERN = /^(?!xn--)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const AUTHORIZATION_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export class SsfSessionRevocationError extends Error {
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(input: {
    readonly code: string;
    readonly retryable: boolean;
    readonly statusCode?: number;
  }) {
    super(input.code);
    this.name = 'SsfSessionRevocationError';
    this.retryable = input.retryable;
    this.statusCode = input.statusCode;
  }
}

export type SsfSessionRevocationClient = Readonly<{
  revoke(input: {
    readonly instanceId: string;
    readonly authorizationRevision: string;
    readonly signal: AbortSignal;
  }): Promise<void>;
}>;

export type SsfControlPlaneClientConfig = Readonly<{
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}>;

const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ssf_session_revocation_base_url_invalid');
  }
  url.pathname = url.pathname.replace(/\/$/u, '');
  return url.toString().replace(/\/$/u, '');
};

const createIdempotencyKey = (instanceId: string, authorizationRevision: string): string =>
  `ssf-authorization:${createHash('sha256')
    .update(`${instanceId}\u0000${authorizationRevision}`, 'utf8')
    .digest('hex')}`;

const isRetryableStatus = (statusCode: number): boolean => statusCode === 429 || statusCode >= 500;

const normalizeTokenUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ssf_control_plane_token_url_invalid');
  }
  return url.toString();
};

export const readSsfControlPlaneClientConfig = (
  environment: NodeJS.ProcessEnv = process.env
): SsfControlPlaneClientConfig | null => {
  const baseUrl = environment[SSF_CONTROL_PLANE_ENV.baseUrl]?.trim();
  const tokenUrl = environment[SSF_CONTROL_PLANE_ENV.tokenUrl]?.trim();
  const clientSecret = environment[SSF_CONTROL_PLANE_ENV.clientSecret]?.trim();
  const clientId =
    environment[SSF_CONTROL_PLANE_ENV.clientId]?.trim() || SSF_CONTROL_PLANE_CLIENT_ID;

  if (!baseUrl && !tokenUrl && !clientSecret) return null;
  if (!baseUrl || !tokenUrl || !clientSecret) {
    throw new Error('ssf_control_plane_configuration_incomplete');
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    tokenUrl: normalizeTokenUrl(tokenUrl),
    clientId,
    clientSecret,
  };
};

export const createSsfClientCredentialsTokenProvider = (dependencies: {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetchImpl?: typeof fetch;
}): ((signal: AbortSignal) => Promise<string>) => {
  const tokenUrl = normalizeTokenUrl(dependencies.tokenUrl);
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  return async (signal) => {
    let response: Response;
    try {
      response = await fetchImpl(tokenUrl, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: dependencies.clientId,
          client_secret: dependencies.clientSecret,
        }),
      });
    } catch {
      throw new SsfSessionRevocationError({
        code: 'ssf_control_plane_token_network_error',
        retryable: true,
      });
    }

    if (!response.ok) {
      throw new SsfSessionRevocationError({
        code: `ssf_control_plane_token_http_${response.status}`,
        statusCode: response.status,
        retryable: isRetryableStatus(response.status),
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SsfSessionRevocationError({
        code: 'ssf_control_plane_token_response_invalid',
        retryable: true,
      });
    }
    const accessToken =
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { access_token?: unknown }).access_token === 'string'
        ? (payload as { access_token: string }).access_token
        : '';
    if (!accessToken) {
      throw new SsfSessionRevocationError({
        code: 'ssf_control_plane_token_response_invalid',
        retryable: true,
      });
    }
    return accessToken;
  };
};

export const createConfiguredSsfSessionRevocationClient = (
  config: SsfControlPlaneClientConfig,
  fetchImpl: typeof fetch = fetch
): SsfSessionRevocationClient =>
  createSsfSessionRevocationClient({
    baseUrl: config.baseUrl,
    fetchImpl,
    getAccessToken: createSsfClientCredentialsTokenProvider({
      tokenUrl: config.tokenUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fetchImpl,
    }),
  });

export const createSsfSessionRevocationClient = (dependencies: {
  readonly baseUrl: string;
  readonly getAccessToken: (signal: AbortSignal) => Promise<string>;
  readonly fetchImpl?: typeof fetch;
  readonly createCorrelationId?: () => string;
}): SsfSessionRevocationClient => {
  const endpoint = `${normalizeBaseUrl(dependencies.baseUrl)}${SSF_SESSION_REVOCATION_PATH}`;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const createCorrelationId = dependencies.createCorrelationId ?? randomUUID;

  return {
    async revoke({ instanceId, authorizationRevision, signal }) {
      if (!INSTANCE_ID_PATTERN.test(instanceId)) {
        throw new SsfSessionRevocationError({
          code: 'ssf_session_revocation_instance_invalid',
          retryable: false,
        });
      }
      if (!AUTHORIZATION_REVISION_PATTERN.test(authorizationRevision)) {
        throw new SsfSessionRevocationError({
          code: 'ssf_session_revocation_revision_invalid',
          retryable: false,
        });
      }

      let accessToken: string;
      try {
        accessToken = await dependencies.getAccessToken(signal);
      } catch (error) {
        if (error instanceof SsfSessionRevocationError) throw error;
        throw new SsfSessionRevocationError({
          code: 'ssf_session_revocation_token_unavailable',
          retryable: true,
        });
      }
      if (!accessToken) {
        throw new SsfSessionRevocationError({
          code: 'ssf_session_revocation_token_invalid',
          retryable: false,
        });
      }

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          signal,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': createIdempotencyKey(instanceId, authorizationRevision),
            'X-Correlation-Id': createCorrelationId(),
            'X-Studio-Instance-Id': instanceId,
          },
          body: JSON.stringify({ authorizationRevision }),
        });
      } catch {
        throw new SsfSessionRevocationError({
          code: 'ssf_session_revocation_network_error',
          retryable: true,
        });
      }

      if (response.status !== 204) {
        throw new SsfSessionRevocationError({
          code: `ssf_session_revocation_http_${response.status}`,
          statusCode: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }
    },
  };
};

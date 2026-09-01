import type { JWTPayload } from 'jose';

import {
  isServiceIdentityProviderUnavailable,
  readServiceTokenClientActions,
  verifyServiceJwt,
  type ServiceTokenVerificationConfig,
} from './service-token.js';

export const SSF_RUNTIME_DEFAULT_AUDIENCE = 'sva-studio-ssf-runtime';
export const SSF_RUNTIME_DEFAULT_CLIENT_ID = 'ssf-runtime';
export const SSF_RUNTIME_REQUIRED_ACTION = 'ssf.runtime-configuration.read';

export interface SsfRuntimeServiceTokenConfig extends ServiceTokenVerificationConfig {
  readonly enabled: boolean;
}

type SsfRuntimeServiceTokenVerifier = (
  token: string,
  config: ServiceTokenVerificationConfig
) => Promise<JWTPayload>;

export type SsfRuntimeServiceAuthentication =
  | { readonly kind: 'authenticated'; readonly subject: string }
  | {
      readonly kind: 'rejected';
      readonly status: 401 | 403 | 503;
      readonly code:
        | 'service_authentication_invalid'
        | 'service_action_forbidden'
        | 'runtime_configuration_unavailable';
      readonly reason:
        | 'service_token_not_configured'
        | 'identity_provider_unavailable'
        | 'invalid_service_token'
        | 'missing_action_scope';
    };

export const readSsfRuntimeServiceTokenConfig = (
  environment: NodeJS.ProcessEnv = process.env
): SsfRuntimeServiceTokenConfig | null => {
  if (environment['SVA_STUDIO_SSF_RUNTIME_ENABLED'] !== 'true') return null;
  const issuer = environment['SVA_STUDIO_SSF_RUNTIME_ISSUER']?.replace(/\/$/u, '');
  if (!issuer) return null;
  return {
    enabled: true,
    issuer,
    audience: environment['SVA_STUDIO_SSF_RUNTIME_AUDIENCE'] ?? SSF_RUNTIME_DEFAULT_AUDIENCE,
    clientId: environment['SVA_STUDIO_SSF_RUNTIME_CLIENT_ID'] ?? SSF_RUNTIME_DEFAULT_CLIENT_ID,
  };
};

export const authenticateSsfRuntimeServiceToken = async (
  token: string,
  config: SsfRuntimeServiceTokenConfig | null = readSsfRuntimeServiceTokenConfig(),
  verifier: SsfRuntimeServiceTokenVerifier = verifyServiceJwt
): Promise<SsfRuntimeServiceAuthentication> => {
  if (!config?.enabled) {
    return {
      kind: 'rejected',
      status: 503,
      code: 'runtime_configuration_unavailable',
      reason: 'service_token_not_configured',
    };
  }

  try {
    const payload = await verifier(token, config);
    if (
      payload.azp !== config.clientId ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      return {
        kind: 'rejected',
        status: 401,
        code: 'service_authentication_invalid',
        reason: 'invalid_service_token',
      };
    }
    if (
      !readServiceTokenClientActions(payload, config.clientId).includes(SSF_RUNTIME_REQUIRED_ACTION)
    ) {
      return {
        kind: 'rejected',
        status: 403,
        code: 'service_action_forbidden',
        reason: 'missing_action_scope',
      };
    }
    return { kind: 'authenticated', subject: payload.sub };
  } catch (error) {
    return isServiceIdentityProviderUnavailable(error)
      ? {
          kind: 'rejected',
          status: 503,
          code: 'runtime_configuration_unavailable',
          reason: 'identity_provider_unavailable',
        }
      : {
          kind: 'rejected',
          status: 401,
          code: 'service_authentication_invalid',
          reason: 'invalid_service_token',
        };
  }
};

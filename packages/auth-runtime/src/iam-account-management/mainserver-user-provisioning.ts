import { z } from 'zod';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';

import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';

import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { normalizeProvisioningUpstreamUrl } from './mainserver-upstream-url-validation.js';
import type { CreateUserActorInfo } from './user-create-invitation.js';
import type { CreateUserPayload } from './user-create-persistence.js';

const SVA_MAINSERVER_TYPE_KEY = 'sva_mainserver';
const USER_PROVISIONINGS_PATH = '/api/v2/user_provisionings';
const MAINSERVER_REQUEST_TIMEOUT_MS = 10_000;
const logger = createSdkLogger({ component: 'iam-mainserver-user-provisioning', level: 'info' });

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const provisioningResponseSchema = z.object({
  keycloak: z.object({
    attributes: z.object({
      mainserverUserApplicationId: z.string().min(1),
      mainserverUserApplicationSecret: z.string().min(1),
    }),
  }),
});

export type ProvisionedMainserverUserCredentials = {
  readonly mainserverUserApplicationId: string;
  readonly mainserverUserApplicationSecret: string;
};

type MainserverProvisioningConfig = {
  readonly oauthTokenUrl: string;
  readonly provisioningUrl: string;
};

type ErrorPayload = {
  readonly code?: string;
  readonly message?: string;
  readonly retryable?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');

const fetchWithTimeout = async (input: {
  readonly fetchImpl: typeof fetch;
  readonly url: string;
  readonly init: RequestInit;
  readonly timeoutMessage: string;
}): Promise<Response> => {
  try {
    return await input.fetchImpl(input.url, {
      ...input.init,
      signal: input.init.signal
        ? AbortSignal.any([input.init.signal, AbortSignal.timeout(MAINSERVER_REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(MAINSERVER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new MainserverUserProvisioningError({
        code: 'upstream_timeout',
        message: input.timeoutMessage,
        statusCode: 504,
        retryable: true,
      });
    }

    throw error;
  }
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige Antwort des SVA-Mainserver-Provisionings.',
      statusCode: 502,
    });
  }
};

const readErrorPayload = async (response: Response): Promise<ErrorPayload> => {
  const payload = await parseJsonBody(response).catch(() => null);
  if (!isRecord(payload)) {
    return {};
  }

  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    retryable: typeof payload.retryable === 'boolean' ? payload.retryable : undefined,
  };
};

const resolveProvisioningUrl = (graphqlBaseUrl: string): string => {
  const graphqlUrl = new URL(graphqlBaseUrl);
  return new URL(USER_PROVISIONINGS_PATH, graphqlUrl.origin).toString();
};

const loadProvisioningConfig = async (instanceId: string): Promise<MainserverProvisioningConfig | null> => {
  const record = await loadDefaultExternalInterfaceRecord(instanceId, SVA_MAINSERVER_TYPE_KEY);
  if (!record || !record.enabled) {
    logger.info('SVA Mainserver user provisioning skipped because integration is not configured', {
      workspace_id: instanceId,
      context: {
        operation: 'mainserver_user_provisioning',
        instance_id: instanceId,
        reason_code: record ? 'integration_disabled' : 'config_not_found',
      },
    });
    return null;
  }

  const publicConfig = isRecord(record.publicConfig) ? record.publicConfig : {};
  const graphqlBaseUrl = typeof publicConfig.graphqlBaseUrl === 'string' ? publicConfig.graphqlBaseUrl.trim() : '';
  const oauthTokenUrl = typeof publicConfig.oauthTokenUrl === 'string' ? publicConfig.oauthTokenUrl.trim() : '';
  if (!graphqlBaseUrl || !oauthTokenUrl) {
    throw new MainserverUserProvisioningError({
      code: 'mainserver_user_provisioning_config_incomplete',
      message: 'SVA-Mainserver-Provisioning ist unvollständig konfiguriert.',
      statusCode: 409,
    });
  }

  return {
    oauthTokenUrl: await normalizeProvisioningUpstreamUrl(oauthTokenUrl, 'oauth_token_url'),
    provisioningUrl: resolveProvisioningUrl(
      await normalizeProvisioningUpstreamUrl(graphqlBaseUrl, 'graphql_base_url')
    ),
  };
};

const loadProvisioningBearerToken = async (input: {
  readonly actor: CreateUserActorInfo;
  readonly actorSubject: string;
  readonly oauthTokenUrl: string;
  readonly fetchImpl: typeof fetch;
}): Promise<string> => {
  const credentialResult = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.actor.instanceId,
    keycloakSubject: input.actorSubject,
  });
  if (credentialResult.status !== 'ok') {
    throw new MainserverUserProvisioningError({
      code: credentialResult.status,
      message: 'Mainserver-Provisioning-Credentials des handelnden Benutzers fehlen.',
      statusCode: 409,
    });
  }

  const response = await fetchWithTimeout({
    fetchImpl: input.fetchImpl,
    url: input.oauthTokenUrl,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentialResult.credentials.apiKey,
        client_secret: credentialResult.credentials.apiSecret,
      }),
    },
    timeoutMessage: 'Zeitüberschreitung beim Laden des Mainserver-Provisioning-Tokens.',
  });

  if (!response.ok) {
    throw new MainserverUserProvisioningError({
      code: response.status === 401 ? 'unauthorized' : 'token_request_failed',
      message: `Mainserver-Provisioning-Token konnte nicht geladen werden (${response.status}).`,
      statusCode: response.status,
      retryable: response.status >= 500,
    });
  }

  const parsed = tokenResponseSchema.safeParse(await parseJsonBody(response));
  if (!parsed.success) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige Token-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  return parsed.data.access_token;
};

export const provisionMainserverUserCredentials = async (input: {
  readonly actor: CreateUserActorInfo;
  readonly actorSubject: string;
  readonly keycloakSubject: string;
  readonly payload: CreateUserPayload;
  readonly fetchImpl?: typeof fetch;
}): Promise<ProvisionedMainserverUserCredentials | null> => {
  const config = await loadProvisioningConfig(input.actor.instanceId);
  if (!config) {
    return null;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const accessToken = await loadProvisioningBearerToken({
    actor: input.actor,
    actorSubject: input.actorSubject,
    oauthTokenUrl: config.oauthTokenUrl,
    fetchImpl,
  });

  const response = await fetchWithTimeout({
    fetchImpl,
    url: config.provisioningUrl,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.payload.email,
        keycloak_id: input.keycloakSubject,
        first_name: input.payload.firstName,
        last_name: input.payload.lastName,
      }),
    },
    timeoutMessage: 'Zeitüberschreitung beim Provisionieren des Mainserver-Benutzers.',
  });

  if (!response.ok) {
    const errorPayload = await readErrorPayload(response);
    throw new MainserverUserProvisioningError({
      code: errorPayload.code ?? 'mainserver_user_provisioning_failed',
      message: errorPayload.message ?? `Mainserver-Benutzer-Provisioning fehlgeschlagen (${response.status}).`,
      statusCode: response.status,
      retryable: errorPayload.retryable ?? response.status >= 500,
    });
  }

  const parsed = provisioningResponseSchema.safeParse(await parseJsonBody(response));
  if (!parsed.success) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige Antwort des SVA-Mainserver-Provisionings.',
      statusCode: 502,
    });
  }

  logger.info('SVA Mainserver user provisioning succeeded', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'mainserver_user_provisioning',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      keycloak_subject: input.keycloakSubject,
    },
  });

  return {
    mainserverUserApplicationId: parsed.data.keycloak.attributes.mainserverUserApplicationId,
    mainserverUserApplicationSecret: parsed.data.keycloak.attributes.mainserverUserApplicationSecret,
  };
};

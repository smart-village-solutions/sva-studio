import { z } from 'zod';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';

import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';

import {
  createProvisioningErrorFromResponse,
  fetchMainserverUpstream,
  parseMainserverJsonBody,
} from './mainserver-upstream-http.js';
import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { normalizeProvisioningUpstreamUrl } from './mainserver-upstream-url-validation.js';
import type { CreateUserActorInfo } from './user-create-invitation.js';
import type { CreateUserPayload } from './user-create-persistence.js';

const SVA_MAINSERVER_TYPE_KEY = 'sva_mainserver';
const USER_PROVISIONINGS_PATH = '/api/v2/user_provisionings';
const MAINSERVER_PROVISIONING_TIMEOUT_MS = 10_000;
const logger = createSdkLogger({ component: 'iam-mainserver-user-provisioning', level: 'info' });

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const provisioningResponseSchema = z.object({
  data_provider_id: z.union([z.string().min(1), z.number().int()]).transform(String),
  keycloak: z.object({
    attributes: z.object({
      mainserverUserApplicationId: z.string().min(1),
      mainserverUserApplicationSecret: z.string().min(1),
    }),
  }),
});

export type ProvisionedMainserverUserCredentials = {
  readonly dataProviderId: string;
  readonly mainserverUserApplicationId: string;
  readonly mainserverUserApplicationSecret: string;
};

type MainserverProvisioningConfig = {
  readonly oauthTokenUrl: string;
  readonly provisioningUrl: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveProvisioningUrl = (graphqlBaseUrl: string): string => {
  const graphqlUrl = new URL(graphqlBaseUrl);
  return new URL(USER_PROVISIONINGS_PATH, graphqlUrl.origin).toString();
};

const loadProvisioningConfig = async (
  instanceId: string
): Promise<MainserverProvisioningConfig | null> => {
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
  const graphqlBaseUrl =
    typeof publicConfig.graphqlBaseUrl === 'string' ? publicConfig.graphqlBaseUrl.trim() : '';
  const oauthTokenUrl =
    typeof publicConfig.oauthTokenUrl === 'string' ? publicConfig.oauthTokenUrl.trim() : '';
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
  readonly signal: AbortSignal;
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

  const response = await fetchMainserverUpstream({
    fetchImpl: input.fetchImpl,
    url: input.oauthTokenUrl,
    signal: input.signal,
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

  const parsed = tokenResponseSchema.safeParse(
    await parseMainserverJsonBody(response, 'Ungültige Token-Antwort des SVA-Mainservers.')
  );
  if (!parsed.success) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige Token-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  return parsed.data.access_token;
};

const parseProvisioningResponse = async (
  response: Response
): Promise<z.infer<typeof provisioningResponseSchema>> => {
  let responseBody: unknown;
  try {
    responseBody = await parseMainserverJsonBody(
      response,
      'Ungültige Antwort des SVA-Mainserver-Provisionings.'
    );
  } catch (error) {
    throw new MainserverUserProvisioningError({
      code: error instanceof MainserverUserProvisioningError ? error.code : 'invalid_response',
      message: 'Ungültige Antwort des SVA-Mainserver-Provisionings.',
      statusCode: 502,
      outcomeUnknown: true,
    });
  }
  const parsed = provisioningResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige Antwort des SVA-Mainserver-Provisionings.',
      statusCode: 502,
      outcomeUnknown: true,
    });
  }
  return parsed.data;
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
  const provisioningSignal = AbortSignal.timeout(MAINSERVER_PROVISIONING_TIMEOUT_MS);
  const accessToken = await loadProvisioningBearerToken({
    actor: input.actor,
    actorSubject: input.actorSubject,
    oauthTokenUrl: config.oauthTokenUrl,
    fetchImpl,
    signal: provisioningSignal,
  });

  let response: Response;
  try {
    response = await fetchMainserverUpstream({
      fetchImpl,
      url: config.provisioningUrl,
      signal: provisioningSignal,
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
  } catch (error) {
    if (error instanceof MainserverUserProvisioningError) {
      throw new MainserverUserProvisioningError({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        retryable: error.retryable,
        outcomeUnknown: true,
      });
    }
    throw new MainserverUserProvisioningError({
      code: 'network_error',
      message: 'Netzwerkfehler beim Provisionieren des Mainserver-Benutzers.',
      statusCode: 503,
      retryable: true,
      outcomeUnknown: true,
    });
  }

  if (!response.ok) {
    await createProvisioningErrorFromResponse(response);
  }

  const parsed = await parseProvisioningResponse(response);

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
    dataProviderId: parsed.data_provider_id,
    mainserverUserApplicationId: parsed.keycloak.attributes.mainserverUserApplicationId,
    mainserverUserApplicationSecret: parsed.keycloak.attributes.mainserverUserApplicationSecret,
  };
};

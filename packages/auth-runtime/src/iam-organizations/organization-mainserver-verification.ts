import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { z } from 'zod';

import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';
import { MainserverUserProvisioningError } from '../iam-account-management/mainserver-user-provisioning-error.js';
import {
  fetchMainserverUpstream,
  parseMainserverJsonBody,
} from '../iam-account-management/mainserver-upstream-http.js';
import { normalizeProvisioningUpstreamUrl } from '../iam-account-management/mainserver-upstream-url-validation.js';

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
const dataProviderResponseSchema = z.object({
  data_provider: z.object({
    id: z.union([z.string().min(1), z.number().int()]).transform(String),
    name: z.string().nullish(),
  }),
});

const readMainserverUrls = async (instanceId: string) => {
  const config = await loadDefaultExternalInterfaceRecord(instanceId, 'sva_mainserver');
  const publicConfig =
    config?.publicConfig && typeof config.publicConfig === 'object' ? config.publicConfig : {};
  const graphqlBaseUrl =
    typeof publicConfig.graphqlBaseUrl === 'string' ? publicConfig.graphqlBaseUrl.trim() : '';
  const oauthTokenUrl =
    typeof publicConfig.oauthTokenUrl === 'string' ? publicConfig.oauthTokenUrl.trim() : '';
  return { enabled: config?.enabled === true, graphqlBaseUrl, oauthTokenUrl };
};

const requireConfiguredMainserver = async (instanceId: string) => {
  const config = await readMainserverUrls(instanceId);
  if (!config.enabled || !config.graphqlBaseUrl || !config.oauthTokenUrl) {
    throw new MainserverUserProvisioningError({
      code: 'mainserver_user_provisioning_config_incomplete',
      message: 'SVA-Mainserver-Provisioning ist nicht vollständig konfiguriert.',
      statusCode: 409,
    });
  }
  return config;
};

export const preflightNewOrganizationProvisioning = async (input: {
  readonly instanceId: string;
  readonly actorSubject: string;
}): Promise<'ready' | 'integration_not_configured'> => {
  const config = await readMainserverUrls(input.instanceId);
  if (!config.enabled) {
    return 'integration_not_configured';
  }
  if (!config.graphqlBaseUrl || !config.oauthTokenUrl) {
    await requireConfiguredMainserver(input.instanceId);
  }
  const personalCredentials = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
  });
  if (personalCredentials.status !== 'ok' || personalCredentials.source !== 'user') {
    throw new MainserverUserProvisioningError({
      code: personalCredentials.status,
      message: 'Persönliche Mainserver-Credentials des handelnden Benutzers fehlen.',
      statusCode: 409,
    });
  }
  return 'ready';
};

export const isAutomaticPreflightSkip = (error: unknown): boolean =>
  error instanceof MainserverUserProvisioningError &&
  (error.code === 'missing_credentials' || error.code === 'identity_provider_unavailable');

const requestAccessToken = async (input: {
  readonly oauthTokenUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly signal: AbortSignal;
}): Promise<string> => {
  const response = await fetchMainserverUpstream({
    fetchImpl: fetch,
    url: await normalizeProvisioningUpstreamUrl(input.oauthTokenUrl, 'oauth_token_url'),
    signal: input.signal,
    init: {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: input.apiKey,
        client_secret: input.apiSecret,
      }),
    },
    timeoutMessage: 'Zeitüberschreitung beim Verifizieren der Organisations-Credentials.',
  });
  if (!response.ok) {
    throw new MainserverUserProvisioningError({
      code: response.status === 401 ? 'unauthorized' : 'token_request_failed',
      message: 'Mainserver-Token für die Organisationsverifikation konnte nicht geladen werden.',
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

const requestDataProvider = async (input: {
  readonly graphqlBaseUrl: string;
  readonly accessToken: string;
  readonly signal: AbortSignal;
}) => {
  const response = await fetchMainserverUpstream({
    fetchImpl: fetch,
    url: new URL(
      '/data_provider.json',
      await normalizeProvisioningUpstreamUrl(input.graphqlBaseUrl, 'graphql_base_url')
    ).toString(),
    signal: input.signal,
    init: {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${input.accessToken}` },
    },
    timeoutMessage: 'Zeitüberschreitung beim Verifizieren der DataProvider-Identität.',
  });
  if (!response.ok) {
    throw new MainserverUserProvisioningError({
      code: 'data_provider_verification_failed',
      message: 'DataProvider-Identität konnte nicht verifiziert werden.',
      statusCode: response.status,
      retryable: response.status >= 500,
    });
  }
  const parsed = dataProviderResponseSchema.safeParse(
    await parseMainserverJsonBody(response, 'Ungültige DataProvider-Antwort des SVA-Mainservers.')
  );
  if (!parsed.success) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: 'Ungültige DataProvider-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }
  return parsed.data.data_provider;
};

export const verifyExistingOrganizationCredentials = async (input: {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly actorSubject: string;
}): Promise<{
  readonly dataProviderId: string;
  readonly dataProviderName?: string;
  readonly credentialFingerprint: string;
}> => {
  const effective = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
    activeOrganizationId: input.organizationId,
    actingPrincipalType: 'organization',
  });
  if (effective.status !== 'ok' || effective.source !== 'organization') {
    throw new MainserverUserProvisioningError({
      code: 'organization_mainserver_credentials_missing',
      message: 'Organisationsbezogene Mainserver-Credentials fehlen.',
      statusCode: 409,
    });
  }
  const config = await requireConfiguredMainserver(input.instanceId);
  const signal = AbortSignal.timeout(10_000);
  const accessToken = await requestAccessToken({
    oauthTokenUrl: config.oauthTokenUrl,
    apiKey: effective.credentials.apiKey,
    apiSecret: effective.credentials.apiSecret,
    signal,
  });
  const dataProvider = await requestDataProvider({
    graphqlBaseUrl: config.graphqlBaseUrl,
    accessToken,
    signal,
  });
  return {
    dataProviderId: dataProvider.id,
    ...(dataProvider.name ? { dataProviderName: dataProvider.name } : {}),
    credentialFingerprint: effective.credentialFingerprint,
  };
};

import type { KeycloakTenantPlan } from './keycloak-types.js';
import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
  PluginOidcClientRequirement,
  PluginOidcClientState,
} from './provisioning-auth-types.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';

const pluginClientIdentifierPattern = /^[a-z][a-z0-9-]{0,62}$/u;
const requirementKeys = new Set(['contractVersion', 'pluginId', 'clientId', 'audience', 'enabled']);

const hasOnlyRequirementKeys = (requirement: PluginOidcClientRequirement): boolean =>
  Object.keys(requirement).every(
    (key) =>
      requirementKeys.has(key) ||
      (requirement.contractVersion === '2.0' && (key === 'redirectUris' || key === 'webOrigins'))
  );

const hasValidBrowserUris = (
  requirement: Extract<PluginOidcClientRequirement, { contractVersion: '2.0' }>
): boolean => {
  try {
    if (
      !Array.isArray(requirement.webOrigins) ||
      !requirement.webOrigins.length ||
      !Array.isArray(requirement.redirectUris) ||
      !requirement.redirectUris.length
    )
      return false;
    const validOrigin = (value: string) => {
      const url = new URL(value);
      return url.protocol === 'https:' && url.origin === value && !value.includes('*');
    };
    return (
      requirement.webOrigins.every(validOrigin) &&
      requirement.redirectUris.every((value) => {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          requirement.webOrigins.includes(url.origin) &&
          url.pathname === '/login/*' &&
          value === `${url.origin}/login/*`
        );
      })
    );
  } catch {
    return false;
  }
};

const hasValidRequirementIdentity = (requirement: PluginOidcClientRequirement): boolean =>
  pluginClientIdentifierPattern.test(requirement.pluginId) &&
  requirement.clientId ===
    (requirement.contractVersion === '2.0'
      ? `${requirement.pluginId}-frontend`
      : requirement.pluginId) &&
  requirement.audience === requirement.clientId;

const conflictsWithReservedClient = (
  requirement: PluginOidcClientRequirement,
  input: Pick<KeycloakProvisioningInput, 'authClientId' | 'tenantAdminClient'>
): boolean =>
  requirement.clientId === input.authClientId ||
  requirement.clientId === input.tenantAdminClient?.clientId;

const isValidRequirement = (
  requirement: PluginOidcClientRequirement,
  input: Pick<KeycloakProvisioningInput, 'authClientId' | 'tenantAdminClient'>
): boolean =>
  hasOnlyRequirementKeys(requirement) &&
  (requirement.contractVersion === '1.0' ||
    (requirement.contractVersion === '2.0' && hasValidBrowserUris(requirement))) &&
  requirement.enabled === false &&
  hasValidRequirementIdentity(requirement) &&
  !conflictsWithReservedClient(requirement, input);

export const readPluginOidcClientRequirements = (
  input: Pick<KeycloakProvisioningInput, 'authClientId' | 'tenantAdminClient' | 'pluginOidcClients'>
): NonNullable<KeycloakProvisioningInput['pluginOidcClients']> => {
  const requirements = input.pluginOidcClients ?? [];
  const clientIds = new Set<string>();
  for (const requirement of requirements) {
    if (!isValidRequirement(requirement, input) || clientIds.has(requirement.clientId)) {
      throw new Error('plugin_oidc_client_requirement_invalid');
    }
    clientIds.add(requirement.clientId);
  }
  return requirements;
};

const isAudienceMapperAligned = (
  requirement: PluginOidcClientRequirement,
  mapper: PluginOidcClientState['protocolMappers'][number] | undefined
): boolean => {
  const config = mapper?.config;
  return (
    mapper?.protocol === 'openid-connect' &&
    mapper.protocolMapper === 'oidc-audience-mapper' &&
    config?.['included.client.audience'] === requirement.audience &&
    (config?.['included.custom.audience'] ?? '') === '' &&
    config?.['id.token.claim'] === 'false' &&
    config?.['access.token.claim'] === 'true' &&
    config?.['lightweight.claim'] === 'false' &&
    config?.['introspection.token.claim'] === 'true'
  );
};

const isPluginFlowAligned = (
  requirement: PluginOidcClientRequirement,
  client: NonNullable<PluginOidcClientState['clientRepresentation']>
): boolean => {
  const browser = requirement.contractVersion === '2.0';
  return (
    client.publicClient === browser &&
    client.standardFlowEnabled === browser &&
    client.implicitFlowEnabled === false &&
    client.directAccessGrantsEnabled === false &&
    client.serviceAccountsEnabled === false &&
    (!browser ||
      (client.attributes?.['pkce.code.challenge.method'] === 'S256' &&
        client.attributes?.['access.token.lifespan'] === '900'))
  );
};

const isPluginClientAligned = (
  requirement: PluginOidcClientRequirement,
  client: PluginOidcClientState['clientRepresentation'] | undefined
): boolean => {
  if (!client) return false;
  const browser = requirement.contractVersion === '2.0';
  return (
    client.clientId === requirement.clientId &&
    (browser ? typeof client.enabled === 'boolean' : client.enabled === false) &&
    client.protocol === 'openid-connect' &&
    (client.rootUrl === undefined || client.rootUrl === '') &&
    equalSets(client.redirectUris ?? [], browser ? requirement.redirectUris : []) &&
    equalSets(readPostLogoutUris(client.attributes), []) &&
    equalSets(client.webOrigins ?? [], browser ? requirement.webOrigins : []) &&
    isPluginFlowAligned(requirement, client)
  );
};

export const readPluginOidcClientAlignment = (
  requirement: PluginOidcClientRequirement,
  state: Pick<PluginOidcClientState, 'clientRepresentation' | 'protocolMappers'> | undefined
) => {
  const client = state?.clientRepresentation;
  const mapper = state?.protocolMappers.find(
    (candidate) => candidate.name === `studio-${requirement.pluginId}-audience`
  );
  const audienceMapperMatches = isAudienceMapperAligned(requirement, mapper);
  const aligned = isPluginClientAligned(requirement, client) && audienceMapperMatches;

  return { client, audienceMapperMatches, aligned };
};

export const findPluginOidcClientState = (
  requirement: PluginOidcClientRequirement,
  state: KeycloakReadState | undefined
): PluginOidcClientState | undefined =>
  state?.pluginOidcClients.find(
    (candidate) => candidate.requirement.clientId === requirement.clientId
  );

export const buildPluginOidcClientStep = (
  requirement: PluginOidcClientRequirement,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'][number] => {
  const alignment = readPluginOidcClientAlignment(
    requirement,
    findPluginOidcClientState(requirement, state)
  );
  const clientExists = Boolean(alignment.client);

  return {
    stepKey: `plugin_client_${requirement.clientId}`,
    title: `Plugin-Client ${requirement.pluginId} abgleichen`,
    action: !clientExists ? 'create' : alignment.aligned ? 'verify' : 'update',
    status: blocked ? 'blocked' : 'ready',
    summary:
      requirement.contractVersion === '2.0'
        ? 'Der Plugin-Client und sein Audience-Mapper werden auf den sicheren Sollzustand abgeglichen.'
        : !clientExists
          ? 'Der deaktivierte Plugin-Client wird ohne Callback- oder Origin-Freigaben angelegt.'
          : alignment.aligned
            ? 'Der Plugin-Client entspricht dem deaktivierten, callbackfreien Sollzustand.'
            : 'Der Plugin-Client und sein Audience-Mapper werden auf den sicheren Sollzustand abgeglichen.',
    details: {
      pluginId: requirement.pluginId,
      clientId: requirement.clientId,
      clientExists,
      clientEnabled: alignment.client?.enabled,
      audienceMapperMatches: alignment.audienceMapperMatches,
    },
  };
};

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
  Object.keys(requirement).every((key) => requirementKeys.has(key));

const hasValidRequirementIdentity = (requirement: PluginOidcClientRequirement): boolean =>
  pluginClientIdentifierPattern.test(requirement.pluginId) &&
  requirement.clientId === requirement.pluginId &&
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
  requirement.contractVersion === '1.0' &&
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

const isPluginClientAligned = (
  requirement: PluginOidcClientRequirement,
  client: PluginOidcClientState['clientRepresentation'] | undefined
): boolean =>
  Boolean(client) &&
  client?.clientId === requirement.clientId &&
  client.enabled === false &&
  (client.rootUrl === undefined || client.rootUrl === '') &&
  equalSets(client.redirectUris ?? [], []) &&
  equalSets(readPostLogoutUris(client.attributes), []) &&
  equalSets(client.webOrigins ?? [], []) &&
  client.standardFlowEnabled === false &&
  client.implicitFlowEnabled === false &&
  client.directAccessGrantsEnabled === false &&
  client.serviceAccountsEnabled === false;

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
    stepKey: `plugin_client_${requirement.pluginId}`,
    title: `Plugin-Client ${requirement.pluginId} abgleichen`,
    action: !clientExists ? 'create' : alignment.aligned ? 'verify' : 'update',
    status: blocked ? 'blocked' : 'ready',
    summary: !clientExists
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

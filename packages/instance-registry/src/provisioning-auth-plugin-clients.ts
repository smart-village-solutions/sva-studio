import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
  PluginOidcClientRequirement,
  PluginOidcClientState,
} from './provisioning-auth-types.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';

const pluginClientIdentifierPattern = /^[a-z][a-z0-9-]{0,62}$/u;
const requirementKeys = new Set([
  'contractVersion',
  'pluginId',
  'clientId',
  'audience',
  'enabled',
]);

export const readPluginOidcClientRequirements = (
  input: Pick<
    KeycloakProvisioningInput,
    'authClientId' | 'tenantAdminClient' | 'pluginOidcClients'
  >
): NonNullable<KeycloakProvisioningInput['pluginOidcClients']> => {
  const requirements = input.pluginOidcClients ?? [];
  const clientIds = new Set<string>();
  for (const requirement of requirements) {
    if (
      Object.keys(requirement).some((key) => !requirementKeys.has(key)) ||
      requirement.contractVersion !== '1.0' ||
      requirement.enabled !== false ||
      !pluginClientIdentifierPattern.test(requirement.pluginId) ||
      requirement.clientId !== requirement.pluginId ||
      requirement.audience !== requirement.clientId ||
      requirement.clientId === input.authClientId ||
      requirement.clientId === input.tenantAdminClient?.clientId ||
      clientIds.has(requirement.clientId)
    ) {
      throw new Error('plugin_oidc_client_requirement_invalid');
    }
    clientIds.add(requirement.clientId);
  }
  return requirements;
};

export const readPluginOidcClientAlignment = (
  requirement: PluginOidcClientRequirement,
  state: Pick<PluginOidcClientState, 'clientRepresentation' | 'protocolMappers'> | undefined
) => {
  const client = state?.clientRepresentation;
  const mapper = state?.protocolMappers.find(
    (candidate) => candidate.name === `studio-${requirement.pluginId}-audience`
  );
  const audienceMapperMatches =
    mapper?.protocol === 'openid-connect' &&
    mapper.protocolMapper === 'oidc-audience-mapper' &&
    mapper.config?.['included.client.audience'] === requirement.audience &&
    mapper.config['included.custom.audience'] === '' &&
    mapper.config['id.token.claim'] === 'false' &&
    mapper.config['access.token.claim'] === 'true' &&
    mapper.config['lightweight.claim'] === 'false' &&
    mapper.config['introspection.token.claim'] === 'true';

  const aligned = Boolean(
    client &&
      client.clientId === requirement.clientId &&
      client.enabled === false &&
      (client.rootUrl === undefined || client.rootUrl === '') &&
      equalSets(client.redirectUris ?? [], []) &&
      equalSets(readPostLogoutUris(client.attributes), []) &&
      equalSets(client.webOrigins ?? [], []) &&
      client.standardFlowEnabled === false &&
      client.directAccessGrantsEnabled === false &&
      client.serviceAccountsEnabled === false &&
      audienceMapperMatches
  );

  return { client, audienceMapperMatches, aligned };
};

export const findPluginOidcClientState = (
  requirement: PluginOidcClientRequirement,
  state: KeycloakReadState | undefined
): PluginOidcClientState | undefined =>
  state?.pluginOidcClients.find(
    (candidate) => candidate.requirement.clientId === requirement.clientId
  );

import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import { isInstanceIdMapperAligned } from './keycloak-realm-baseline.js';
import {
  isSystemAdminRoleOwnedByInstance,
  readStudioOwnedClient,
  readStudioOwnedUser,
} from './provisioning-auth-policy.js';
import { readPluginOidcClientAlignment } from './provisioning-auth-plugin-clients.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';

export const buildMissingRealmStatus = (
  authClientSecretConfigured: boolean,
  authClientSecret?: string,
  tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'],
  tenantAdminClientSecret?: string,
  pluginOidcClientsAligned = false
): KeycloakTenantStatus => ({
  realmExists: false,
  clientExists: false,
  tenantAdminClientExists: false,
  systemAdminRoleExists: false,
  tenantAdminExists: false,
  tenantAdminHasSystemAdmin: false,
  redirectUrisMatch: false,
  logoutUrisMatch: false,
  webOriginsMatch: false,
  pluginOidcClientsAligned,
  clientSecretConfigured: authClientSecretConfigured,
  tenantClientSecretReadable: Boolean(authClientSecret),
  clientSecretAligned: false,
  tenantAdminClientSecretConfigured: tenantAdminClient?.secretConfigured ?? false,
  tenantAdminClientSecretReadable: Boolean(tenantAdminClientSecret),
  tenantAdminClientSecretAligned: false,
  runtimeSecretSource: authClientSecret ? 'tenant' : 'global',
  realmBaselineAligned: false,
  userProfileBaselineAligned: false,
  instanceIdMapperAligned: false,
  smtpPasswordConfigured: false,
});

export const buildKeycloakStatus = (
  input: Pick<
    KeycloakProvisioningInput,
    | 'authClientSecretConfigured'
    | 'authClientSecret'
    | 'instanceId'
    | 'authRealm'
    | 'authClientId'
    | 'realmMode'
    | 'tenantAdminClient'
    | 'tenantAdminClientSecret'
  > & {
    state: KeycloakReadState;
  }
): KeycloakTenantStatus => {
  const loginClientOwned =
    readStudioOwnedClient(input.state.clientRepresentation, input.instanceId, 'login_client') ===
    'owned';
  const tenantAdminClientOwned =
    readStudioOwnedClient(
      input.state.tenantAdminClientRepresentation,
      input.instanceId,
      'tenant_admin_client'
    ) === 'owned';
  const tenantAdminOwned =
    readStudioOwnedUser(input.state.tenantAdminRepresentation, input.instanceId, 'tenant_admin') ===
    'owned';
  const clientSecretAligned =
    loginClientOwned &&
    Boolean(
      input.authClientSecret &&
      input.state.keycloakClientSecret &&
      input.authClientSecret === input.state.keycloakClientSecret
    );
  const tenantAdminClientSecretAligned =
    tenantAdminClientOwned &&
    Boolean(
      input.tenantAdminClientSecret &&
      input.state.tenantAdminClientSecret &&
      input.tenantAdminClientSecret === input.state.tenantAdminClientSecret
    );

  return {
    realmExists: true,
    clientExists: loginClientOwned,
    tenantAdminClientExists: tenantAdminClientOwned,
    systemAdminRoleExists: isSystemAdminRoleOwnedByInstance(
      input.state.systemAdminRole,
      input.instanceId
    ),
    tenantAdminExists: tenantAdminOwned && input.state.tenantAdminStatus.tenantAdminExists,
    tenantAdminHasSystemAdmin:
      tenantAdminOwned && input.state.tenantAdminStatus.tenantAdminHasSystemAdmin,
    redirectUrisMatch:
      loginClientOwned &&
      equalSets(
        input.state.clientRepresentation?.redirectUris ?? [],
        input.state.expectedClient.redirectUris
      ),
    logoutUrisMatch:
      loginClientOwned &&
      equalSets(
        readPostLogoutUris(input.state.clientRepresentation?.attributes),
        input.state.expectedClient.postLogoutRedirectUris
      ),
    webOriginsMatch:
      loginClientOwned &&
      equalSets(
        input.state.clientRepresentation?.webOrigins ?? [],
        input.state.expectedClient.webOrigins
      ),
    pluginOidcClientsAligned: arePluginOidcClientsAligned(input.state, input.instanceId),
    clientSecretConfigured: input.authClientSecretConfigured,
    tenantClientSecretReadable: Boolean(input.authClientSecret),
    clientSecretAligned,
    tenantAdminClientSecretConfigured: input.tenantAdminClient?.secretConfigured ?? false,
    tenantAdminClientSecretReadable: Boolean(input.tenantAdminClientSecret),
    tenantAdminClientSecretAligned,
    runtimeSecretSource: input.authClientSecret ? 'tenant' : 'global',
    realmBaselineAligned: input.state.realmBaselineAligned,
    userProfileBaselineAligned: input.state.userProfileBaselineAligned,
    instanceIdMapperAligned: isOwnedInstanceIdMapperAligned(input.state, loginClientOwned),
    smtpPasswordConfigured: input.state.realm?.smtpPasswordConfigured ?? false,
  };
};

const arePluginOidcClientsAligned = (state: KeycloakReadState, instanceId: string): boolean =>
  state.pluginOidcClients.every(
    ({ requirement, ...clientState }) =>
      readStudioOwnedClient(
        clientState.clientRepresentation,
        instanceId,
        `plugin_client:${requirement.pluginId}`
      ) === 'owned' && readPluginOidcClientAlignment(requirement, clientState).aligned
  );

const isOwnedInstanceIdMapperAligned = (
  state: KeycloakReadState,
  loginClientOwned: boolean
): boolean => loginClientOwned && (state.protocolMappers ?? []).some(isInstanceIdMapperAligned);

import type { IamInstanceKeycloakStatus } from '../iam/account-management-contract.js';

type InstanceKeycloakBooleanStatusField = Exclude<keyof IamInstanceKeycloakStatus, 'runtimeSecretSource'>;

export type InstanceKeycloakRequirementKey =
  | 'realm'
  | 'client'
  | 'tenant_admin_client'
  | 'redirect_uris'
  | 'logout_uris'
  | 'web_origins'
  | 'plugin_oidc_clients'
  | 'tenant_secret'
  | 'tenant_admin_client_secret'
  | 'system_admin_role'
  | 'tenant_admin'
  | 'tenant_admin_system_admin';

export type InstanceKeycloakRequirement = {
  readonly key: InstanceKeycloakRequirementKey;
  readonly statusField: InstanceKeycloakBooleanStatusField;
  readonly expectedValue: boolean;
  readonly sourceFields: readonly string[];
  readonly dbFields: readonly string[];
  readonly keycloakArtifacts: readonly string[];
  readonly workerStepKey: string;
  readonly uiStepKey: string;
  /**
   * Currently unevaluated metadata reserved for future login-specific consumers.
   * Operational readiness evaluates every requirement.
   */
  readonly blocksLoginReadiness?: boolean;
};

export const INSTANCE_KEYCLOAK_REQUIREMENTS: readonly InstanceKeycloakRequirement[] = [
  {
    key: 'realm',
    statusField: 'realmExists',
    expectedValue: true,
    sourceFields: ['realmMode', 'authRealm'],
    dbFields: ['iam.instances.realm_mode', 'iam.instances.auth_realm'],
    keycloakArtifacts: ['realm:<authRealm>'],
    workerStepKey: 'realm',
    uiStepKey: 'realm',
  },
  {
    key: 'client',
    statusField: 'clientExists',
    expectedValue: true,
    sourceFields: ['authClientId'],
    dbFields: ['iam.instances.auth_client_id'],
    keycloakArtifacts: ['client:<authClientId>'],
    workerStepKey: 'client',
    uiStepKey: 'client',
  },
  {
    key: 'tenant_admin_client',
    statusField: 'tenantAdminClientExists',
    expectedValue: true,
    sourceFields: ['tenantAdminClient.clientId'],
    dbFields: ['iam.instances.tenant_admin_client_id'],
    keycloakArtifacts: ['client:<tenantAdminClient.clientId>'],
    workerStepKey: 'tenant_admin_client',
    uiStepKey: 'tenantAdminClient',
  },
  {
    key: 'redirect_uris',
    statusField: 'redirectUrisMatch',
    expectedValue: true,
    sourceFields: ['instanceId', 'parentDomain'],
    dbFields: ['iam.instances.id', 'iam.instances.parent_domain', 'iam.instances.primary_hostname'],
    keycloakArtifacts: ['client.redirectUris'],
    workerStepKey: 'client',
    uiStepKey: 'client',
  },
  {
    key: 'logout_uris',
    statusField: 'logoutUrisMatch',
    expectedValue: true,
    sourceFields: ['instanceId', 'parentDomain'],
    dbFields: ['iam.instances.id', 'iam.instances.parent_domain', 'iam.instances.primary_hostname'],
    keycloakArtifacts: ['client.attributes.post.logout.redirect.uris'],
    workerStepKey: 'client',
    uiStepKey: 'client',
  },
  {
    key: 'web_origins',
    statusField: 'webOriginsMatch',
    expectedValue: true,
    sourceFields: ['instanceId', 'parentDomain'],
    dbFields: ['iam.instances.id', 'iam.instances.parent_domain', 'iam.instances.primary_hostname'],
    keycloakArtifacts: ['client.webOrigins'],
    workerStepKey: 'client',
    uiStepKey: 'client',
  },
  {
    key: 'plugin_oidc_clients',
    statusField: 'pluginOidcClientsAligned',
    expectedValue: true,
    sourceFields: ['pluginSources[].oidcClient'],
    dbFields: [],
    keycloakArtifacts: [
      'plugin-client:<pluginOidcClient.clientId>',
      'plugin-client-audience-mapper:<pluginOidcClient.audience>',
    ],
    workerStepKey: 'plugin_oidc_clients',
    uiStepKey: 'pluginOidcClients',
    blocksLoginReadiness: false,
  },
  {
    key: 'tenant_secret',
    statusField: 'clientSecretAligned',
    expectedValue: true,
    sourceFields: ['authClientSecret'],
    dbFields: ['iam.instances.auth_client_secret_ciphertext'],
    keycloakArtifacts: ['client-secret:<authClientId>'],
    workerStepKey: 'secret',
    uiStepKey: 'tenantSecret',
  },
  {
    key: 'tenant_admin_client_secret',
    statusField: 'tenantAdminClientSecretAligned',
    expectedValue: true,
    sourceFields: ['tenantAdminClient.secretConfigured'],
    dbFields: ['iam.instances.tenant_admin_client_secret_ciphertext'],
    keycloakArtifacts: ['client-secret:<tenantAdminClient.clientId>'],
    workerStepKey: 'tenant_admin_client_secret',
    uiStepKey: 'tenantAdminClient',
  },
  {
    key: 'system_admin_role',
    statusField: 'systemAdminRoleExists',
    expectedValue: true,
    sourceFields: ['instanceId'],
    dbFields: ['iam.instances.id'],
    keycloakArtifacts: ['role:system_admin'],
    workerStepKey: 'roles',
    uiStepKey: 'tenantAdmin',
  },
  {
    key: 'tenant_admin',
    statusField: 'tenantAdminExists',
    expectedValue: true,
    sourceFields: [
      'tenantAdminBootstrap.username',
      'tenantAdminBootstrap.email',
      'tenantAdminBootstrap.firstName',
      'tenantAdminBootstrap.lastName',
    ],
    dbFields: [
      'iam.instances.tenant_admin_username',
      'iam.instances.tenant_admin_email',
      'iam.instances.tenant_admin_first_name',
      'iam.instances.tenant_admin_last_name',
    ],
    keycloakArtifacts: ['user:<tenantAdminBootstrap.username>'],
    workerStepKey: 'tenant_admin',
    uiStepKey: 'tenantAdmin',
  },
  {
    key: 'tenant_admin_system_admin',
    statusField: 'tenantAdminHasSystemAdmin',
    expectedValue: true,
    sourceFields: ['tenantAdminBootstrap.username'],
    dbFields: ['iam.instances.tenant_admin_username'],
    keycloakArtifacts: ['user-role:system_admin'],
    workerStepKey: 'roles',
    uiStepKey: 'tenantAdmin',
  },
] as const;

export const isInstanceKeycloakRequirementSatisfied = (
  status: IamInstanceKeycloakStatus,
  requirement: InstanceKeycloakRequirement
): boolean => status[requirement.statusField] === requirement.expectedValue;

export const isInstanceTenantAdminRequired = (input: {
  readonly realmMode: 'new' | 'existing';
  readonly tenantAdminBootstrap?: { readonly username: string };
}): boolean => input.realmMode !== 'existing' || Boolean(input.tenantAdminBootstrap?.username);

export const getApplicableInstanceKeycloakRequirements = (options: {
  readonly requireTenantAdmin?: boolean;
} = {}): readonly InstanceKeycloakRequirement[] =>
  options.requireTenantAdmin === false
    ? INSTANCE_KEYCLOAK_REQUIREMENTS.filter(
        (requirement) =>
          requirement.key !== 'tenant_admin' &&
          requirement.key !== 'tenant_admin_system_admin'
      )
    : INSTANCE_KEYCLOAK_REQUIREMENTS;

export const areAllInstanceKeycloakRequirementsSatisfied = (
  status: IamInstanceKeycloakStatus,
  options: { readonly requireTenantAdmin?: boolean } = {}
): boolean =>
  getApplicableInstanceKeycloakRequirements(options).every((requirement) =>
    isInstanceKeycloakRequirementSatisfied(status, requirement)
  );

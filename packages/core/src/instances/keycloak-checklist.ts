import type { IamInstanceKeycloakStatus } from '../iam/account-management-contract.js';

type InstanceKeycloakBooleanStatusField = Exclude<keyof IamInstanceKeycloakStatus, 'runtimeSecretSource'>;

export type InstanceKeycloakRequirementKey =
  | 'realm'
  | 'client'
  | 'redirect_uris'
  | 'logout_uris'
  | 'web_origins'
  | 'instance_id_mapper'
  | 'tenant_secret'
  | 'tenant_admin'
  | 'tenant_admin_system_admin'
  | 'tenant_admin_lacks_instance_registry_admin'
  | 'tenant_admin_instance_id';

export type InstanceKeycloakRequirement = {
  readonly key: InstanceKeycloakRequirementKey;
  readonly statusField: InstanceKeycloakBooleanStatusField;
  readonly expectedValue: boolean;
  readonly sourceFields: readonly string[];
  readonly dbFields: readonly string[];
  readonly keycloakArtifacts: readonly string[];
  readonly workerStepKey: string;
  readonly uiStepKey: string;
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
    key: 'instance_id_mapper',
    statusField: 'instanceIdMapperExists',
    expectedValue: true,
    sourceFields: ['instanceId'],
    dbFields: ['iam.instances.id'],
    keycloakArtifacts: ['protocol-mapper:instanceId'],
    workerStepKey: 'mapper',
    uiStepKey: 'mapper',
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
  {
    key: 'tenant_admin_lacks_instance_registry_admin',
    statusField: 'tenantAdminHasInstanceRegistryAdmin',
    expectedValue: false,
    sourceFields: ['tenantAdminBootstrap.username'],
    dbFields: ['iam.instances.tenant_admin_username'],
    keycloakArtifacts: ['user-role:instance_registry_admin'],
    workerStepKey: 'roles',
    uiStepKey: 'tenantAdmin',
  },
  {
    key: 'tenant_admin_instance_id',
    statusField: 'tenantAdminInstanceIdMatches',
    expectedValue: true,
    sourceFields: ['instanceId', 'tenantAdminBootstrap.username'],
    dbFields: ['iam.instances.id', 'iam.instances.tenant_admin_username'],
    keycloakArtifacts: ['user-attribute:instanceId'],
    workerStepKey: 'tenant_admin',
    uiStepKey: 'tenantAdmin',
  },
] as const;

export const isInstanceKeycloakRequirementSatisfied = (
  status: IamInstanceKeycloakStatus,
  requirement: InstanceKeycloakRequirement
): boolean => status[requirement.statusField] === requirement.expectedValue;

export const areAllInstanceKeycloakRequirementsSatisfied = (status: IamInstanceKeycloakStatus): boolean =>
  INSTANCE_KEYCLOAK_REQUIREMENTS.every((requirement) => isInstanceKeycloakRequirementSatisfied(status, requirement));

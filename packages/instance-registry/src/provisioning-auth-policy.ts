import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
} from './provisioning-auth-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import { SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';

export const KEYCLOAK_SNAPSHOT_POLICY_VERSION = 3;

export type KeycloakSnapshotSecretVersions = Readonly<{
  authClientSecretCiphertext: string | null;
  tenantAdminClientSecretCiphertext: string | null;
}>;

export const buildKeycloakSnapshotInputFingerprint = (instance: {
  readonly instanceId: string;
  readonly primaryHostname: string;
  readonly realmMode: KeycloakProvisioningInput['realmMode'];
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecretConfigured: boolean;
  readonly tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'];
  readonly tenantAdminBootstrap?: KeycloakProvisioningInput['tenantAdminBootstrap'];
}, secrets?: Partial<KeycloakSnapshotSecretVersions>, pluginOidcClients: KeycloakProvisioningInput['pluginOidcClients'] = []): string =>
  buildPayloadFingerprint({
    instanceId: instance.instanceId,
    primaryHostname: instance.primaryHostname,
    realmMode: instance.realmMode,
    authRealm: instance.authRealm,
    authClientId: instance.authClientId,
    authIssuerUrl: instance.authIssuerUrl,
    authClientSecretConfigured: instance.authClientSecretConfigured,
    tenantAdminClient: instance.tenantAdminClient,
    tenantAdminBootstrap: instance.tenantAdminBootstrap,
    authClientSecretCiphertext: secrets?.authClientSecretCiphertext ?? null,
    tenantAdminClientSecretCiphertext: secrets?.tenantAdminClientSecretCiphertext ?? null,
    pluginOidcClients: [...pluginOidcClients].sort((left, right) =>
      left.pluginId.localeCompare(right.pluginId) || left.clientId.localeCompare(right.clientId)
    ),
  });

const readSingleRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return values?.length === 1 ? values[0] : undefined;
};

export const isSystemAdminRoleOwnedByInstance = (
  role: KeycloakReadState['systemAdminRole'] | undefined,
  instanceId: string
): boolean =>
  role?.externalName === SYSTEM_ADMIN_ROLE &&
  readSingleRoleAttribute(role.attributes, 'managed_by') === 'studio' &&
  readSingleRoleAttribute(role.attributes, 'instance_id') === instanceId &&
  readSingleRoleAttribute(role.attributes, 'role_key') === SYSTEM_ADMIN_ROLE;

export const isLegacyRealmRoleMigrationAllowed = (
  instances: readonly { readonly instanceId: string; readonly authRealm: string }[],
  current: { readonly instanceId: string; readonly authRealm: string }
): boolean => {
  const realmAssignments = instances.filter(
    (instance) => instance.authRealm === current.authRealm
  );
  return realmAssignments.length === 1 && realmAssignments[0]?.instanceId === current.instanceId;
};

export const resolveLegacyRealmRoleMigrationAllowed = async (
  repository: {
    readonly listInstances?: () => Promise<
      readonly { readonly instanceId: string; readonly authRealm: string }[]
    >;
  },
  current: { readonly instanceId: string; readonly authRealm: string }
): Promise<boolean> => {
  const instances = await repository.listInstances?.();
  return instances ? isLegacyRealmRoleMigrationAllowed(instances, current) : false;
};

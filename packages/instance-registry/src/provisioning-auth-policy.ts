import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
} from './provisioning-auth-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import { SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';

export const KEYCLOAK_SNAPSHOT_POLICY_VERSION = 2;

export const buildKeycloakSnapshotInputFingerprint = (instance: {
  readonly instanceId: string;
  readonly updatedAt: string;
}): string =>
  buildPayloadFingerprint({
    instanceId: instance.instanceId,
    updatedAt: instance.updatedAt,
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
  realmMode: KeycloakProvisioningInput['realmMode'],
  repository: {
    readonly listInstances?: () => Promise<
      readonly { readonly instanceId: string; readonly authRealm: string }[]
    >;
  },
  current: { readonly instanceId: string; readonly authRealm: string }
): Promise<boolean> => {
  if (realmMode !== 'existing') return false;
  const instances = await repository.listInstances?.();
  return instances ? isLegacyRealmRoleMigrationAllowed(instances, current) : false;
};

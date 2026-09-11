import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';

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

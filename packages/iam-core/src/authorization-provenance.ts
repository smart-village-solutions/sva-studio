import type {
  EffectivePermission,
  IamPermissionProvenance,
  IamPermissionSourceKind,
} from './authorization-contract.js';

const resolveSourceKinds = (
  permission: EffectivePermission
): readonly IamPermissionSourceKind[] | undefined => {
  const sourceKinds = permission.provenance?.sourceKinds;
  if (sourceKinds && sourceKinds.length > 0) {
    return sourceKinds;
  }

  const derivedKinds = new Set<IamPermissionSourceKind>();
  const sourceRoleIds = permission.sourceRoleIds ?? [];
  const sourceGroupIds = permission.sourceGroupIds ?? [];
  if (sourceRoleIds.length > 0) {
    derivedKinds.add('direct_role');
  }
  if (sourceGroupIds.length > 0) {
    derivedKinds.add('group_role');
  }
  return derivedKinds.size > 0 ? [...derivedKinds] : undefined;
};

export const buildPermissionProvenance = (
  permission: EffectivePermission,
  overrides?: Partial<IamPermissionProvenance>
): IamPermissionProvenance | undefined => {
  const sourceKinds = resolveSourceKinds(permission);
  const provenance = {
    ...(permission.provenance ?? {}),
    ...(sourceKinds ? { sourceKinds } : {}),
    ...(overrides ?? {}),
  };

  return Object.keys(provenance).length > 0 ? provenance : undefined;
};

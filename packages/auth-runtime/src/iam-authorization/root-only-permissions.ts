import type { EffectivePermission } from '@sva/iam-core';

const ROOT_ONLY_PERMISSION_KEYS = new Set(['instance.registry.manage']);

export const filterTenantEffectivePermissions = (
  permissions: readonly EffectivePermission[]
): EffectivePermission[] =>
  permissions.filter((permission) => {
    const action = typeof permission.action === 'string' ? permission.action.trim() : '';
    return action.length === 0 || !ROOT_ONLY_PERMISSION_KEYS.has(action);
  });

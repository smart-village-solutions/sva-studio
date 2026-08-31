/**
 * Pure comparison helpers for access requirements linked across plugin contributions.
 *
 * Plugin registries use these helpers to keep route, navigation, and action access
 * metadata semantically aligned without coupling the comparison to registry wiring.
 */
import type { UiAccessRequirement } from '@sva/iam-core';

type TenantAccessRequirement = Extract<UiAccessRequirement, { kind: 'tenant' }>;
type PlatformAccessRequirement = Extract<UiAccessRequirement, { kind: 'platform' }>;

const haveEqualValues = (left: readonly string[], right: readonly string[]): boolean => {
  const leftValues = new Set(left);
  const rightValues = new Set(right);

  return (
    leftValues.size === rightValues.size && [...leftValues].every((value) => rightValues.has(value))
  );
};

const haveEqualTenantRequirements = (
  left: TenantAccessRequirement,
  right: TenantAccessRequirement
): boolean =>
  left.moduleId === right.moduleId &&
  left.resourceContext === right.resourceContext &&
  left.actions.mode === right.actions.mode &&
  haveEqualValues(left.actions.values, right.actions.values);

const haveEqualPlatformRequirements = (
  left: PlatformAccessRequirement,
  right: PlatformAccessRequirement
): boolean =>
  left.roles.mode === right.roles.mode && haveEqualValues(left.roles.values, right.roles.values);

export const hasMatchingPluginAccessRequirement = (
  left: UiAccessRequirement | undefined,
  right: UiAccessRequirement | undefined
): boolean => {
  if (!left || !right) {
    return left === right;
  }
  if (left.kind === 'tenant' && right.kind === 'tenant') {
    return haveEqualTenantRequirements(left, right);
  }
  if (left.kind === 'platform' && right.kind === 'platform') {
    return haveEqualPlatformRequirements(left, right);
  }
  return left.kind === right.kind;
};

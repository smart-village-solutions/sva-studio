export const permissionRequirementModes = ['allOf', 'anyOf'] as const;
export type PermissionRequirementMode = (typeof permissionRequirementModes)[number];

export const permissionDenialReasons = [
  'permission_missing',
  'instance_scope_mismatch',
  'context_attribute_missing',
  'abac_condition_unmet',
  'hierarchy_restriction',
  'policy_conflict_restrictive_wins',
  'geo_scope_mismatch',
  'group_restriction',
] as const;
export type PermissionDenialReason = (typeof permissionDenialReasons)[number];

export const isPermissionDenialReason = (value: unknown): value is PermissionDenialReason =>
  permissionDenialReasons.some((candidate) => candidate === value);

export type PermissionDenialDetails = Readonly<{
  required_permissions: readonly string[];
  requirement_mode: PermissionRequirementMode;
  denial_reason: PermissionDenialReason;
}>;

const MAX_PERMISSION_COUNT = 16;
const MAX_PERMISSION_LENGTH = 128;
const permissionActionPattern = /^[a-z][a-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/;

export const isPermissionActionId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_PERMISSION_LENGTH &&
  permissionActionPattern.test(value);

const normalizePermissionActions = (values: readonly unknown[]): readonly string[] =>
  Array.from(new Set(values.filter(isPermissionActionId))).slice(0, MAX_PERMISSION_COUNT);

export const createPermissionDenialDetails = (input: {
  readonly requiredPermissions: readonly string[];
  readonly requirementMode?: PermissionRequirementMode;
  readonly denialReason?: PermissionDenialReason;
}): PermissionDenialDetails => {
  const requiredPermissions = normalizePermissionActions(input.requiredPermissions);
  if (requiredPermissions.length === 0) {
    throw new Error('permission_denial_requires_valid_permission');
  }

  return {
    required_permissions: requiredPermissions,
    requirement_mode: input.requirementMode ?? 'allOf',
    denial_reason: input.denialReason ?? 'permission_missing',
  };
};

export const createPermissionDenialDetailsForAction = (
  action: string,
  denialReason: unknown
): PermissionDenialDetails | undefined =>
  isPermissionDenialReason(denialReason)
    ? createPermissionDenialDetails({ requiredPermissions: [action], denialReason })
    : undefined;

const readRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

export const parsePermissionDenialDetails = (
  value: unknown
): PermissionDenialDetails | undefined => {
  const details = readRecord(value);
  if (!details || !Array.isArray(details.required_permissions)) {
    return undefined;
  }

  const requiredPermissions = normalizePermissionActions(details.required_permissions);
  if (requiredPermissions.length === 0) {
    return undefined;
  }

  const requirementMode = permissionRequirementModes.find(
    (candidate) => candidate === details.requirement_mode
  );
  const denialReason = permissionDenialReasons.find(
    (candidate) => candidate === details.denial_reason
  );
  if (!requirementMode || !denialReason) {
    return undefined;
  }

  return {
    required_permissions: requiredPermissions,
    requirement_mode: requirementMode,
    denial_reason: denialReason,
  };
};

export const isMissingPermissionDenial = (details: PermissionDenialDetails): boolean =>
  details.denial_reason === 'permission_missing';

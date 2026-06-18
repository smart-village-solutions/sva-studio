import type { IamUserDetail, IamUserPermissionTraceItem } from '@sva/core';

import { t } from '../../../i18n';
import { formatEditorDateTime } from '../../../lib/editor-date-time';
import type { UpdateUserPayload } from '../../../lib/iam-api';

export type UserEditTabKey = 'personal' | 'management' | 'permissions' | 'history';

export type UserFormValues = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  status: 'active' | 'inactive' | 'pending';
  preferredLanguage: string;
  timezone: string;
  notes: string;
  roleIds: string[];
  groupIds: string[];
  mainserverUserApplicationId: string;
  mainserverUserApplicationSecret: string;
  mainserverUserApplicationSecretSet: boolean;
};

export const USER_EDIT_TABS: ReadonlyArray<{
  key: UserEditTabKey;
  labelKey: 'personal' | 'management' | 'permissions' | 'history';
}> = [
  { key: 'personal', labelKey: 'personal' },
  { key: 'management', labelKey: 'management' },
  { key: 'permissions', labelKey: 'permissions' },
  { key: 'history', labelKey: 'history' },
];

export const userEditTabTranslationKeyByValue = {
  personal: 'admin.users.edit.tab.personal',
  management: 'admin.users.edit.tab.management',
  permissions: 'admin.users.edit.tab.permissions',
  history: 'admin.users.edit.tab.history',
} as const;

export const userStatusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

export const userHistoryCategoryTranslationKeyByValue = {
  iam: 'admin.users.edit.historyCategory.iam',
  governance: 'admin.users.edit.historyCategory.governance',
  dsr: 'admin.users.edit.historyCategory.dsr',
} as const;

export const userHistoryPerspectiveTranslationKeyByValue = {
  actor: 'admin.users.edit.historyPerspective.actor',
  target: 'admin.users.edit.historyPerspective.target',
  actor_and_target: 'admin.users.edit.historyPerspective.actor_and_target',
} as const;

export const permissionTraceStatusTranslationKeyByValue = {
  effective: 'admin.users.edit.permissionTrace.status.effective',
  inactive: 'admin.users.edit.permissionTrace.status.inactive',
  expired: 'admin.users.edit.permissionTrace.status.expired',
  disabled: 'admin.users.edit.permissionTrace.status.disabled',
} as const;

export const permissionTraceInactiveReasonTranslationKeyByValue = {
  assignment_not_started: 'admin.users.edit.permissionTrace.inactiveReason.assignmentNotStarted',
  assignment_expired: 'admin.users.edit.permissionTrace.inactiveReason.assignmentExpired',
  membership_not_started: 'admin.users.edit.permissionTrace.inactiveReason.membershipNotStarted',
  membership_expired: 'admin.users.edit.permissionTrace.inactiveReason.membershipExpired',
  group_disabled: 'admin.users.edit.permissionTrace.inactiveReason.groupDisabled',
  hierarchy_restricted: 'admin.users.edit.permissionTrace.inactiveReason.hierarchyRestricted',
} as const;

export const permissionTraceSourceTranslationKeyByValue = {
  direct_permission: 'admin.users.edit.permissionTrace.source.directPermission',
  direct_role: 'admin.users.edit.permissionTrace.source.directRole',
  group_role: 'admin.users.edit.permissionTrace.source.groupRole',
} as const;

export const permissionTraceRuntimeScopeTranslationKeyByValue = {
  instance: 'admin.users.edit.permissionTrace.runtimeScope.instance',
  record: 'admin.users.edit.permissionTrace.runtimeScope.record',
  organization_context: 'admin.users.edit.permissionTrace.runtimeScope.organizationContext',
} as const;

type UserGroupMembership = NonNullable<NonNullable<IamUserDetail['groups']>[number]>;

export const toUserFormValues = (user: IamUserDetail | null | undefined): UserFormValues => ({
  firstName: user?.firstName ?? '',
  lastName: user?.lastName ?? '',
  displayName: user?.displayName ?? '',
  email: user?.email ?? '',
  phone: user?.phone ?? '',
  position: user?.position ?? '',
  department: user?.department ?? '',
  status: user?.status ?? 'pending',
  preferredLanguage: user?.preferredLanguage ?? 'de',
  timezone: user?.timezone ?? 'Europe/Berlin',
  notes: user?.notes ?? '',
  roleIds: user?.roles.map((entry) => entry.roleId) ?? [],
  groupIds: user?.groups?.map((entry) => entry.groupId) ?? [],
  mainserverUserApplicationId: user?.mainserverUserApplicationId ?? '',
  mainserverUserApplicationSecret: '',
  mainserverUserApplicationSecretSet: user?.mainserverUserApplicationSecretSet ?? false,
});

export const toUserUpdatePayload = (formValues: UserFormValues): UpdateUserPayload => ({
  firstName: formValues.firstName || undefined,
  lastName: formValues.lastName || undefined,
  displayName: formValues.displayName || undefined,
  email: formValues.email || undefined,
  phone: formValues.phone || undefined,
  position: formValues.position || undefined,
  department: formValues.department || undefined,
  status: formValues.status,
  preferredLanguage: formValues.preferredLanguage || undefined,
  timezone: formValues.timezone || undefined,
  notes: formValues.notes.slice(0, 2000) || undefined,
  roleIds: formValues.roleIds,
  groupIds: formValues.groupIds,
  mainserverUserApplicationId: formValues.mainserverUserApplicationId.trim(),
  mainserverUserApplicationSecret: formValues.mainserverUserApplicationSecret.trim() || undefined,
});

export const pickInitials = (displayName: string) => {
  const parts = displayName
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'NA';
  }

  return parts.map((entry) => entry.charAt(0).toUpperCase()).join('');
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }

  return formatEditorDateTime(value) ?? value;
};

export const formatRoleValidity = (input: { validFrom?: string; validTo?: string }) => {
  if (input.validFrom && input.validTo) {
    return t('admin.users.edit.roleValidityRange', {
      from: formatDateTime(input.validFrom),
      to: formatDateTime(input.validTo),
    });
  }
  if (input.validFrom) {
    return t('admin.users.edit.roleValidityFrom', { from: formatDateTime(input.validFrom) });
  }
  if (input.validTo) {
    return t('admin.users.edit.roleValidityTo', { to: formatDateTime(input.validTo) });
  }
  return null;
};

export const formatMetadata = (metadata: Readonly<Record<string, unknown>>) => {
  if (Object.keys(metadata).length === 0) {
    return null;
  }

  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
};

export const formatScope = (scope?: Readonly<Record<string, unknown>>) => {
  if (!scope || Object.keys(scope).length === 0) {
    return null;
  }

  return Object.entries(scope)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
};

export const describePermissionTraceSource = (entry: IamUserPermissionTraceItem) => {
  const base = t(permissionTraceSourceTranslationKeyByValue[entry.sourceKind]);
  if (entry.sourceKind === 'direct_permission') {
    return base;
  }

  if (entry.sourceKind === 'group_role') {
    const parts = [base];
    if (entry.groupDisplayName) {
      parts.push(entry.groupDisplayName);
    }
    if (entry.roleName) {
      parts.push(entry.roleName);
    }
    return parts.join(' · ');
  }

  return entry.roleName ? `${base} · ${entry.roleName}` : base;
};

export const describePermissionTraceRuntimeScope = (entry: IamUserPermissionTraceItem) =>
  entry.runtimeScope ? t(permissionTraceRuntimeScopeTranslationKeyByValue[entry.runtimeScope]) : null;

export const formatTraceValidity = (entry: Pick<IamUserPermissionTraceItem, 'validFrom' | 'validTo'>) => {
  if (entry.validFrom && entry.validTo) {
    return t('admin.users.edit.permissionTrace.validityRange', {
      from: formatDateTime(entry.validFrom),
      to: formatDateTime(entry.validTo),
    });
  }
  if (entry.validFrom) {
    return t('admin.users.edit.permissionTrace.validityFrom', { from: formatDateTime(entry.validFrom) });
  }
  if (entry.validTo) {
    return t('admin.users.edit.permissionTrace.validityTo', { to: formatDateTime(entry.validTo) });
  }
  return null;
};

export const buildPermissionTraceDetails = (entry: IamUserPermissionTraceItem): readonly string[] => {
  const details: string[] = [];

  if (entry.inheritedFromOrganizationId) {
    details.push(
      t('admin.users.edit.permissionTrace.inheritedOrganization', {
        value: entry.inheritedFromOrganizationId,
      })
    );
  }
  if (entry.inheritedFromGeoUnitId) {
    details.push(
      t('admin.users.edit.permissionTrace.inheritedGeoUnit', {
        value: entry.inheritedFromGeoUnitId,
      })
    );
  }
  if (entry.restrictedByGeoUnitId) {
    details.push(
      t('admin.users.edit.permissionTrace.restrictedGeoUnit', {
        value: entry.restrictedByGeoUnitId,
      })
    );
  }
  if (entry.inactiveReason) {
    details.push(
      t('admin.users.edit.permissionTrace.inactiveReasonLabel', {
        value: t(permissionTraceInactiveReasonTranslationKeyByValue[entry.inactiveReason]),
      })
    );
  }

  const validityText = formatTraceValidity(entry);
  if (validityText) {
    details.push(validityText);
  }

  return details;
};

export const appendUnique = (values: readonly string[], nextValue: string): string[] =>
  values.includes(nextValue) ? [...values] : [...values, nextValue];

const areStringArraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const buildGroupMembershipById = (
  groups: IamUserDetail['groups'] | undefined
): ReadonlyMap<string, UserGroupMembership> => new Map((groups ?? []).map((entry) => [entry.groupId, entry] as const));

export const hasUserFormChanges = (baseline: UserFormValues, current: UserFormValues): boolean =>
  baseline.firstName !== current.firstName ||
  baseline.lastName !== current.lastName ||
  baseline.displayName !== current.displayName ||
  baseline.email !== current.email ||
  baseline.phone !== current.phone ||
  baseline.position !== current.position ||
  baseline.department !== current.department ||
  baseline.status !== current.status ||
  baseline.preferredLanguage !== current.preferredLanguage ||
  baseline.timezone !== current.timezone ||
  baseline.notes !== current.notes ||
  !areStringArraysEqual(baseline.roleIds, current.roleIds) ||
  !areStringArraysEqual(baseline.groupIds, current.groupIds) ||
  baseline.mainserverUserApplicationId !== current.mainserverUserApplicationId ||
  baseline.mainserverUserApplicationSecret !== current.mainserverUserApplicationSecret ||
  baseline.mainserverUserApplicationSecretSet !== current.mainserverUserApplicationSecretSet;

export const splitPermissionTrace = (permissionTrace: readonly IamUserPermissionTraceItem[] | undefined) => ({
  effective: (permissionTrace ?? []).filter((entry) => entry.isEffective),
  inactive: (permissionTrace ?? []).filter((entry) => !entry.isEffective),
});

import type { IamUserDetail } from '@sva/core';

import type {
  UpdateUserPersistencePayload,
  UserMainserverCredentialState,
  UserUpdatePersistenceDeps,
} from './user-update-persistence.js';

const UPDATED_USER_ACTIVITY_FIELD_NAMES = {
  email: 'email',
  displayName: 'display_name',
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  position: 'position',
  department: 'department',
  avatarUrl: 'avatar_url',
  preferredLanguage: 'preferred_language',
  timezone: 'timezone',
  status: 'status',
  notes: 'notes',
  roleIds: 'roles',
  groupIds: 'groups',
} satisfies Record<keyof UpdateUserPersistencePayload, string>;

const toSortedUniqueIds = (values: readonly string[] | undefined): readonly string[] | undefined =>
  values ? [...new Set(values)].sort((left, right) => left.localeCompare(right)) : undefined;

const diffAddedIds = (
  previousIds: readonly string[] | undefined,
  nextIds: readonly string[] | undefined
): readonly string[] | undefined =>
  previousIds && nextIds ? nextIds.filter((id) => previousIds.includes(id) === false) : undefined;

const diffRemovedIds = (
  previousIds: readonly string[] | undefined,
  nextIds: readonly string[] | undefined
): readonly string[] | undefined =>
  previousIds && nextIds ? previousIds.filter((id) => nextIds.includes(id) === false) : undefined;

const resolveChangedFields = (payload: UpdateUserPersistencePayload): readonly string[] =>
  Object.entries(UPDATED_USER_ACTIVITY_FIELD_NAMES)
    .filter(([field]) => payload[field as keyof UpdateUserPersistencePayload] !== undefined)
    .map(([, activityField]) => activityField);

const resolveChangedIds = (
  nextIds: readonly string[] | undefined,
  previousIds: readonly string[] | undefined
) => {
  const previous = nextIds ? toSortedUniqueIds(previousIds ?? []) : undefined;
  const next = nextIds ? toSortedUniqueIds(nextIds) : undefined;

  return {
    previous,
    next,
    added: diffAddedIds(previous, next),
    removed: diffRemovedIds(previous, next),
  };
};

export const buildUpdatedUserActivityPayload = (input: {
  readonly payload: UpdateUserPersistencePayload;
  readonly existingRoleIds?: readonly string[];
  readonly existingGroupIds?: readonly string[];
}) => {
  const roleIds = resolveChangedIds(input.payload.roleIds, input.existingRoleIds);
  const groupIds = resolveChangedIds(input.payload.groupIds, input.existingGroupIds);

  return {
    status: input.payload.status,
    role_update: Boolean(input.payload.roleIds),
    group_update: Boolean(input.payload.groupIds),
    changed_fields: resolveChangedFields(input.payload),
    previous_role_ids: roleIds.previous,
    next_role_ids: roleIds.next,
    added_role_ids: roleIds.added,
    removed_role_ids: roleIds.removed,
    previous_group_ids: groupIds.previous,
    next_group_ids: groupIds.next,
    added_group_ids: groupIds.added,
    removed_group_ids: groupIds.removed,
  };
};

export const resolveUpdatedUserSessionAction = (status: UpdateUserPersistencePayload['status']) =>
  status === 'inactive' ? ('revoke' as const) : status === 'active' ? ('clear' as const) : undefined;

export const buildPersistedUserDetail = (
  detail: IamUserDetail | undefined,
  input: {
    readonly existingMainserverCredentialState?: UserMainserverCredentialState;
    readonly nextMainserverCredentialState?: UserMainserverCredentialState;
  }
) => {
  if (!detail) {
    return undefined;
  }

  const mainserverCredentialState =
    input.nextMainserverCredentialState ?? input.existingMainserverCredentialState;

  return mainserverCredentialState
    ? {
        ...detail,
        mainserverUserApplicationId: mainserverCredentialState.mainserverUserApplicationId,
        mainserverUserApplicationSecretSet: mainserverCredentialState.mainserverUserApplicationSecretSet,
      }
    : detail;
};

export const applyUpdatedUserSessionAction = async (
  deps: Pick<UserUpdatePersistenceDeps, 'clearUserSessionLoginBlock' | 'revokeUserSessions'>,
  input: {
    readonly keycloakSubject: string;
    readonly sessionAction: ReturnType<typeof resolveUpdatedUserSessionAction>;
  }
) => {
  if (input.sessionAction === 'revoke') {
    await deps.revokeUserSessions({
      keycloakSubject: input.keycloakSubject,
      reason: 'user_status_inactivated',
    });
    return;
  }

  if (input.sessionAction === 'clear') {
    await deps.clearUserSessionLoginBlock(input.keycloakSubject);
  }
};

import type { IamUserDetail } from '@sva/core';

import { getRoleExternalName } from './role-audit.js';
import { resolveTenantTechnicalKeycloakRoleNames } from './role-governance.js';
import type { QueryClient } from './query-client.js';
import type { IamGroupRow, IamRoleRow } from './types.js';
import { mapRoles } from './user-mapping.js';

type CreateUserPersistencePayload = {
  readonly email: string;
  readonly displayName?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly avatarUrl?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly notes?: string;
  readonly roleIds: readonly string[];
  readonly groupIds?: readonly string[];
};

type CreateUserPersistenceActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly actorRoles?: readonly string[];
  readonly requestId?: string;
  readonly traceId?: string;
};

type CreateUserPersistenceDeps = {
  readonly protectField: (value: string | undefined, context: string) => string | null;
  readonly resolveGroupsByIds: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly groupIds: readonly string[] }
  ) => Promise<readonly IamGroupRow[]>;
  readonly resolveRoleIdsForGroups: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly groupIds: readonly string[] }
  ) => Promise<readonly string[]>;
  readonly ensureRoleAssignmentWithinActorLevel: (input: {
    readonly client: QueryClient;
    readonly instanceId: string;
    readonly actorSubject: string;
    readonly actorRoles?: readonly string[];
    readonly roleIds: readonly string[];
  }) => Promise<
    { readonly ok: true; readonly roles: readonly IamRoleRow[] } | { readonly ok: false; readonly code: string; readonly message: string }
  >;
};

export const buildDisplayName = (
  payload: CreateUserPersistencePayload,
  externalId: string
): string => payload.displayName ?? ([payload.firstName, payload.lastName].filter(Boolean).join(' ') || externalId);

export const buildCreateAccountParams = (
  deps: Pick<CreateUserPersistenceDeps, 'protectField'>,
  actor: CreateUserPersistenceActor,
  payload: CreateUserPersistencePayload,
  externalId: string
): readonly (string | null)[] => [
  actor.instanceId,
  externalId,
  deps.protectField(payload.email, `iam.accounts.email:${externalId}`),
  deps.protectField(buildDisplayName(payload, externalId), `iam.accounts.display_name:${externalId}`),
  deps.protectField(payload.firstName, `iam.accounts.first_name:${externalId}`),
  deps.protectField(payload.lastName, `iam.accounts.last_name:${externalId}`),
  deps.protectField(payload.phone, `iam.accounts.phone:${externalId}`),
  payload.position ?? null,
  payload.department ?? null,
  payload.avatarUrl ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
  payload.status ?? 'pending',
  payload.notes ?? null,
];

export const validateRequestedGroups = async (
  deps: Pick<
    CreateUserPersistenceDeps,
    'resolveGroupsByIds' | 'resolveRoleIdsForGroups' | 'ensureRoleAssignmentWithinActorLevel'
  >,
  client: QueryClient,
  input: {
    readonly actor: CreateUserPersistenceActor;
    readonly actorSubject: string;
    readonly groupIds: readonly string[];
  }
): Promise<void> => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  if (uniqueGroupIds.length === 0) {
    return;
  }

  const groups = await deps.resolveGroupsByIds(client, {
    instanceId: input.actor.instanceId,
    groupIds: uniqueGroupIds,
  });
  if (groups.length !== uniqueGroupIds.length) {
    throw new Error('invalid_request:Mindestens eine aktive Gruppe existiert nicht.');
  }

  const groupedRoleIds = await deps.resolveRoleIdsForGroups(client, {
    instanceId: input.actor.instanceId,
    groupIds: uniqueGroupIds,
  });
  if (groupedRoleIds.length === 0) {
    return;
  }

  const roleValidation = await deps.ensureRoleAssignmentWithinActorLevel({
    client,
    instanceId: input.actor.instanceId,
    actorSubject: input.actorSubject,
    actorRoles: input.actor.actorRoles,
    roleIds: groupedRoleIds,
  });
  if (!roleValidation.ok) {
    throw new Error(`${roleValidation.code}:${roleValidation.message}`);
  }
};

export const resolveAssignedRoleIds = async (
  deps: Pick<CreateUserPersistenceDeps, 'resolveRoleIdsForGroups'>,
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly roleIds: readonly string[];
    readonly groupIds: readonly string[];
  }
): Promise<readonly string[]> => {
  const groupedRoleIds =
    input.groupIds.length === 0
      ? []
      : await deps.resolveRoleIdsForGroups(client, {
          instanceId: input.instanceId,
          groupIds: input.groupIds,
        });

  return [...new Set([...input.roleIds, ...groupedRoleIds])];
};

export const buildCreatedUserResult = (
  accountId: string,
  externalId: string,
  payload: CreateUserPersistencePayload,
  assignedRoleRows: readonly IamRoleRow[]
): { readonly responseData: IamUserDetail; readonly roleNames: readonly string[] } => ({
  responseData: {
    id: accountId,
    keycloakSubject: externalId,
    displayName: buildDisplayName(payload, externalId),
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    position: payload.position,
    department: payload.department,
    preferredLanguage: payload.preferredLanguage,
    timezone: payload.timezone,
    avatarUrl: payload.avatarUrl,
    notes: payload.notes,
    status: payload.status ?? 'pending',
    roles: mapRoles(assignedRoleRows),
    mainserverUserApplicationSecretSet: false,
  },
  roleNames: [...new Set([
    ...assignedRoleRows.map((entry) => getRoleExternalName(entry)),
    ...resolveTenantTechnicalKeycloakRoleNames(assignedRoleRows),
  ])],
});

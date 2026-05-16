import type { IamUserDetail } from '@sva/core';

import type { QueryClient } from './query-client.js';
import type { IamGroupRow, IamRoleRow } from './types.js';
import {
  buildCreateAccountParams,
  buildCreatedUserResult,
  resolveAssignedRoleIds,
  validateRequestedGroups,
} from './user-create-persistence-support.js';

export type CreateUserPersistencePayload = {
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

export type CreateUserPersistenceActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly actorRoles?: readonly string[];
  readonly requestId?: string;
  readonly traceId?: string;
};

type CreateUserActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly subjectId?: string;
  readonly eventType: 'user.created';
  readonly result: 'success';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type CreateUserPersistenceDeps = {
  readonly assignGroups: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId: string;
      readonly groupIds: readonly string[];
      readonly origin?: 'manual' | 'seed' | 'sync';
    }
  ) => Promise<void>;
  readonly assignRoles: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId: string;
      readonly roleIds: readonly string[];
      readonly assignedBy?: string;
    }
  ) => Promise<void>;
  readonly emitActivityLog: (client: QueryClient, input: CreateUserActivityLogInput) => Promise<void>;
  readonly ensureRoleAssignmentWithinActorLevel: (input: {
    readonly client: QueryClient;
    readonly instanceId: string;
    readonly actorSubject: string;
    readonly actorRoles?: readonly string[];
    readonly roleIds: readonly string[];
  }) => Promise<{ readonly ok: true; readonly roles: readonly IamRoleRow[] } | { readonly ok: false; readonly code: string; readonly message: string }>;
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject?: string;
      readonly trigger: string;
    }
  ) => Promise<void>;
  readonly protectField: (value: string | undefined, context: string) => string | null;
  readonly resolveGroupsByIds: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly groupIds: readonly string[] }
  ) => Promise<readonly IamGroupRow[]>;
  readonly resolveRoleIdsForGroups: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly groupIds: readonly string[] }
  ) => Promise<readonly string[]>;
  readonly resolveRolesByIds: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly roleIds: readonly string[] }
  ) => Promise<readonly IamRoleRow[]>;
};

const INSERT_ACCOUNT_QUERY = `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  email_ciphertext,
  display_name_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext,
  phone_ciphertext,
  position,
  department,
  avatar_url,
  preferred_language,
  timezone,
  status,
  notes
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12,
  $13,
  $14
)
RETURNING id;
`;

const INSERT_MEMBERSHIP_QUERY = `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`;

export const createUserCreatePersistence = (deps: CreateUserPersistenceDeps) => {
  const persistCreatedUser = async (
    client: QueryClient,
    input: {
      readonly actor: CreateUserPersistenceActor;
      readonly actorSubject: string;
      readonly externalId: string;
      readonly payload: CreateUserPersistencePayload;
    }
  ): Promise<{ readonly responseData: IamUserDetail; readonly roleNames: readonly string[] }> => {
    const { actor, actorSubject, externalId, payload } = input;
    const roleValidation = await deps.ensureRoleAssignmentWithinActorLevel({
      client,
      instanceId: actor.instanceId,
      actorSubject,
      actorRoles: actor.actorRoles,
      roleIds: payload.roleIds,
    });
    if (!roleValidation.ok) {
      throw new Error(`${roleValidation.code}:${roleValidation.message}`);
    }
    await validateRequestedGroups(deps, client, {
      actor,
      actorSubject,
      groupIds: payload.groupIds ?? [],
    });

    const inserted = await client.query<{ readonly id: string }>(
      INSERT_ACCOUNT_QUERY,
      buildCreateAccountParams(deps, actor, payload, externalId)
    );
    const accountId = inserted.rows[0]?.id;
    if (!accountId) {
      throw new Error('conflict:Account konnte nicht erstellt werden.');
    }

    await client.query(INSERT_MEMBERSHIP_QUERY, [actor.instanceId, accountId]);
    await deps.assignRoles(client, {
      instanceId: actor.instanceId,
      accountId,
      roleIds: payload.roleIds,
      assignedBy: actor.actorAccountId,
    });
    await deps.assignGroups(client, {
      instanceId: actor.instanceId,
      accountId,
      groupIds: payload.groupIds ?? [],
      origin: 'manual',
    });

    const assignedRoleIds = await resolveAssignedRoleIds(deps, client, {
      instanceId: actor.instanceId,
      roleIds: payload.roleIds,
      groupIds: payload.groupIds ?? [],
    });
    const assignedRoleRows = await deps.resolveRolesByIds(client, {
      instanceId: actor.instanceId,
      roleIds: assignedRoleIds,
    });

    await deps.emitActivityLog(client, {
      instanceId: actor.instanceId,
      accountId: actor.actorAccountId,
      subjectId: accountId,
      eventType: 'user.created',
      result: 'success',
      payload: {
        target_keycloak_subject: externalId,
        role_count: payload.roleIds.length,
        group_count: payload.groupIds?.length ?? 0,
      },
      requestId: actor.requestId,
      traceId: actor.traceId,
    });

    await deps.notifyPermissionInvalidation(client, {
      instanceId: actor.instanceId,
      keycloakSubject: externalId,
      trigger: 'user_role_changed',
    });
    await deps.notifyPermissionInvalidation(client, {
      instanceId: actor.instanceId,
      keycloakSubject: externalId,
      trigger: 'user_group_changed',
    });

    return buildCreatedUserResult(accountId, externalId, payload, assignedRoleRows);
  };

  return {
    persistCreatedUser,
  };
};

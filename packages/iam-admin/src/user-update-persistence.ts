import type { IamUserDetail } from '@sva/core';

import { protectField } from './encryption.js';
import type { QueryClient } from './query-client.js';

export type UpdateUserPersistencePayload = {
  readonly email?: string;
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
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
};

export type UserMainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

type UserActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly subjectId?: string;
  readonly eventType: 'user.updated';
  readonly result: 'success';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type UserUpdatePersistenceDeps = {
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
  readonly emitActivityLog: (client: QueryClient, input: UserActivityLogInput) => Promise<void>;
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject?: string;
      readonly trigger: string;
    }
  ) => Promise<void>;
  readonly resolveUserDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<IamUserDetail | undefined>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export const buildUpdatedUserParams = (
  userId: string,
  instanceId: string,
  keycloakSubject: string,
  payload: {
    readonly email?: string;
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
  }
): readonly (string | null)[] => [
  userId,
  instanceId,
  payload.email ? protectField(payload.email, `iam.accounts.email:${keycloakSubject}`) : null,
  payload.displayName ? protectField(payload.displayName, `iam.accounts.display_name:${keycloakSubject}`) : null,
  payload.firstName ? protectField(payload.firstName, `iam.accounts.first_name:${keycloakSubject}`) : null,
  payload.lastName ? protectField(payload.lastName, `iam.accounts.last_name:${keycloakSubject}`) : null,
  payload.phone ? protectField(payload.phone, `iam.accounts.phone:${keycloakSubject}`) : null,
  payload.position ?? null,
  payload.department ?? null,
  payload.avatarUrl ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
  payload.status ?? null,
  payload.notes ?? null,
];

const updateUserAccountRecord = async (input: {
  readonly client: QueryClient;
  readonly instanceId: string;
  readonly userId: string;
  readonly keycloakSubject: string;
  readonly payload: UpdateUserPersistencePayload;
}) => {
  await input.client.query(
    `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  first_name_ciphertext = COALESCE($5, first_name_ciphertext),
  last_name_ciphertext = COALESCE($6, last_name_ciphertext),
  phone_ciphertext = COALESCE($7, phone_ciphertext),
  position = COALESCE($8, position),
  department = COALESCE($9, department),
  avatar_url = COALESCE($10, avatar_url),
  preferred_language = COALESCE($11, preferred_language),
  timezone = COALESCE($12, timezone),
  status = COALESCE($13, status),
  notes = COALESCE($14, notes),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2;
`,
    buildUpdatedUserParams(input.userId, input.instanceId, input.keycloakSubject, input.payload)
  );
};

const emitUpdatedUserActivity = async (
  deps: Pick<UserUpdatePersistenceDeps, 'emitActivityLog'>,
  input: {
    readonly client: QueryClient;
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly userId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly payload: UpdateUserPersistencePayload;
  }
) =>
  deps.emitActivityLog(input.client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    subjectId: input.userId,
    eventType: 'user.updated',
    result: 'success',
    payload: {
      status: input.payload.status,
      role_update: Boolean(input.payload.roleIds),
      group_update: Boolean(input.payload.groupIds),
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });

const invalidateUpdatedUserPermissions = async (
  deps: Pick<UserUpdatePersistenceDeps, 'notifyPermissionInvalidation'>,
  input: {
    readonly client: QueryClient;
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly payload: UpdateUserPersistencePayload;
  }
) => {
  if (input.payload.roleIds) {
    await deps.notifyPermissionInvalidation(input.client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      trigger: 'user_role_changed',
    });
  }

  if (input.payload.groupIds) {
    await deps.notifyPermissionInvalidation(input.client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      trigger: 'user_group_changed',
    });
  }

  await deps.notifyPermissionInvalidation(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    trigger: 'user_updated',
  });
};

export const createUserUpdatePersistence = (deps: UserUpdatePersistenceDeps) => {
  const persistUpdatedUserDetail = async (input: {
    readonly instanceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly actorAccountId: string;
    readonly userId: string;
    readonly keycloakSubject: string;
    readonly payload: UpdateUserPersistencePayload;
    readonly nextMainserverCredentialState: UserMainserverCredentialState;
  }) =>
    deps.withInstanceScopedDb(input.instanceId, async (client) => {
      if (input.payload.roleIds) {
        await deps.assignRoles(client, {
          instanceId: input.instanceId,
          accountId: input.userId,
          roleIds: input.payload.roleIds,
          assignedBy: input.actorAccountId,
        });
      }

      if (input.payload.groupIds) {
        await deps.assignGroups(client, {
          instanceId: input.instanceId,
          accountId: input.userId,
          groupIds: input.payload.groupIds,
          origin: 'manual',
        });
      }

      await updateUserAccountRecord({
        client,
        instanceId: input.instanceId,
        userId: input.userId,
        keycloakSubject: input.keycloakSubject,
        payload: input.payload,
      });
      await emitUpdatedUserActivity(deps, {
        client,
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        userId: input.userId,
        requestId: input.requestId,
        traceId: input.traceId,
        payload: input.payload,
      });
      await invalidateUpdatedUserPermissions(deps, {
        client,
        instanceId: input.instanceId,
        keycloakSubject: input.keycloakSubject,
        payload: input.payload,
      });

      const detail = await deps.resolveUserDetail(client, {
        instanceId: input.instanceId,
        userId: input.userId,
      });
      if (!detail) {
        return undefined;
      }

      return {
        ...detail,
        mainserverUserApplicationId: input.nextMainserverCredentialState.mainserverUserApplicationId,
        mainserverUserApplicationSecretSet: input.nextMainserverCredentialState.mainserverUserApplicationSecretSet,
      };
    });

  return {
    persistUpdatedUserDetail,
  };
};

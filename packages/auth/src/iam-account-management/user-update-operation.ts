import type { IdentityUserAttributes } from '../identity-provider-port.js';
import {
  getSvaMainserverCredentialAttributeNames,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.server.js';

import { assignGroups, assignRoles } from './shared-assignment.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb, resolveIdentityProvider } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  buildIdentityAttributesForUserUpdate,
} from './user-update-identity.js';
import type { UpdateUserPayload, UserUpdatePlan } from './user-update-plan.js';
import { buildUpdatedUserParams } from './user-update-utils.js';

export const resolveUpdatedIdentityState = async (input: {
  plan: UserUpdatePlan;
  payload: UpdateUserPayload;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
}) => {
  const shouldUpdateIdentityAttributes =
    input.payload.displayName !== undefined ||
    input.payload.mainserverUserApplicationId !== undefined ||
    input.payload.mainserverUserApplicationSecret !== undefined;
  const shouldUpdateIdentity =
    input.payload.email !== undefined ||
    input.payload.firstName !== undefined ||
    input.payload.lastName !== undefined ||
    input.payload.status !== undefined ||
    shouldUpdateIdentityAttributes;

  let existingIdentityAttributes: IdentityUserAttributes | undefined;
  let nextIdentityAttributes: IdentityUserAttributes | undefined;
  let nextMainserverCredentialState = resolveMainserverCredentialState(undefined);

  if (shouldUpdateIdentityAttributes) {
    existingIdentityAttributes = await trackKeycloakCall('get_user_attributes_for_update', () =>
      input.identityProvider.provider.getUserAttributes(input.plan.existing.keycloakSubject)
    );
    nextIdentityAttributes = buildIdentityAttributesForUserUpdate({
      existingAttributes: existingIdentityAttributes,
      payload: input.payload,
    });
    nextMainserverCredentialState = resolveMainserverCredentialState(nextIdentityAttributes);
  } else {
    nextMainserverCredentialState = await trackKeycloakCall('get_user_attributes_for_response', () =>
      input.identityProvider.provider
        .getUserAttributes(input.plan.existing.keycloakSubject, getSvaMainserverCredentialAttributeNames())
        .then((attributes) => resolveMainserverCredentialState(attributes))
    );
  }

  return {
    existingIdentityAttributes,
    nextIdentityAttributes,
    nextMainserverCredentialState,
    shouldUpdateIdentity,
  };
};

const updateUserAccountRecord = async (input: {
  client: Parameters<typeof withInstanceScopedDb>[1] extends (client: infer T) => Promise<unknown> ? T : never;
  instanceId: string;
  userId: string;
  keycloakSubject: string;
  payload: UpdateUserPayload;
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

const emitUpdatedUserActivity = async (input: {
  client: Parameters<typeof withInstanceScopedDb>[1] extends (client: infer T) => Promise<unknown> ? T : never;
  instanceId: string;
  actorAccountId: string;
  userId: string;
  requestId?: string;
  traceId?: string;
  payload: UpdateUserPayload;
}) =>
  emitActivityLog(input.client, {
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

const invalidateUpdatedUserPermissions = async (input: {
  client: Parameters<typeof withInstanceScopedDb>[1] extends (client: infer T) => Promise<unknown> ? T : never;
  instanceId: string;
  keycloakSubject: string;
  payload: UpdateUserPayload;
}) => {
  if (input.payload.roleIds) {
    await notifyPermissionInvalidation(input.client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      trigger: 'user_role_changed',
    });
  }

  if (input.payload.groupIds) {
    await notifyPermissionInvalidation(input.client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      trigger: 'user_group_changed',
    });
  }

  await notifyPermissionInvalidation(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    trigger: 'user_updated',
  });
};

export const persistUpdatedUserDetail = async (input: {
  instanceId: string;
  requestId?: string;
  traceId?: string;
  actorAccountId: string;
  userId: string;
  keycloakSubject: string;
  payload: UpdateUserPayload;
  nextMainserverCredentialState: ReturnType<typeof resolveMainserverCredentialState>;
}) =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    if (input.payload.roleIds) {
      await assignRoles(client, {
        instanceId: input.instanceId,
        accountId: input.userId,
        roleIds: input.payload.roleIds,
        assignedBy: input.actorAccountId,
      });
    }

    if (input.payload.groupIds) {
      await assignGroups(client, {
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
    await emitUpdatedUserActivity({
      client,
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      userId: input.userId,
      requestId: input.requestId,
      traceId: input.traceId,
      payload: input.payload,
    });
    await invalidateUpdatedUserPermissions({
      client,
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      payload: input.payload,
    });

    const detail = await resolveUserDetail(client, {
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

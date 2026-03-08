import type { ActorInfo } from './types';
import { z } from 'zod';

import { jitProvisionAccountWithClient } from '../jit-provisioning.server';
import type { QueryClient } from '../shared/db-helpers';

import { protectField } from './encryption';
import {
  emitActivityLog,
  resolveActorAccountId,
  withInstanceScopedDb,
} from './shared';
import { updateMyProfileSchema } from './schemas';
import { resolveUserDetail } from './user-detail-query';

export type ProfileUpdatePayload = z.infer<typeof updateMyProfileSchema>;

const UPDATE_PROFILE_QUERY = `
UPDATE iam.accounts
SET
  first_name_ciphertext = COALESCE($3, first_name_ciphertext),
  last_name_ciphertext = COALESCE($4, last_name_ciphertext),
  display_name_ciphertext = COALESCE($5, display_name_ciphertext),
  phone_ciphertext = COALESCE($6, phone_ciphertext),
  position = COALESCE($7, position),
  department = COALESCE($8, department),
  preferred_language = COALESCE($9, preferred_language),
  timezone = COALESCE($10, timezone),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`;

const resolveOrProvisionAccountId = async (
  client: QueryClient,
  actor: ActorInfo,
  keycloakSubject: string
): Promise<string> => {
  const existingAccountId = await resolveActorAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject,
  });
  if (existingAccountId) {
    return existingAccountId;
  }

  const provisioned = await jitProvisionAccountWithClient(client, {
    instanceId: actor.instanceId,
    keycloakSubject,
    requestId: actor.requestId,
    traceId: actor.traceId,
  });
  return provisioned.accountId;
};

const buildProfileUpdateParams = (
  accountId: string,
  instanceId: string,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
): readonly (string | null)[] => [
  accountId,
  instanceId,
  payload.firstName ? protectField(payload.firstName, `iam.accounts.first_name:${keycloakSubject}`) : null,
  payload.lastName ? protectField(payload.lastName, `iam.accounts.last_name:${keycloakSubject}`) : null,
  payload.displayName ? protectField(payload.displayName, `iam.accounts.display_name:${keycloakSubject}`) : null,
  payload.phone ? protectField(payload.phone, `iam.accounts.phone:${keycloakSubject}`) : null,
  payload.position ?? null,
  payload.department ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
];

const persistProfileUpdate = async (
  client: QueryClient,
  actor: ActorInfo,
  accountId: string,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
): Promise<void> => {
  await client.query(
    UPDATE_PROFILE_QUERY,
    buildProfileUpdateParams(accountId, actor.instanceId, keycloakSubject, payload)
  );

  await emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId,
    subjectId: accountId,
    eventType: 'user.profile_updated',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });
};

export const loadMyProfileDetail = async (
  actor: ActorInfo,
  keycloakSubject: string
) => withInstanceScopedDb(actor.instanceId, async (client) => {
  const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);
  return resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
});

export const updateMyProfileDetail = async (
  actor: ActorInfo,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
) => withInstanceScopedDb(actor.instanceId, async (client) => {
  const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);
  await persistProfileUpdate(client, actor, accountId, keycloakSubject, payload);
  return resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
});

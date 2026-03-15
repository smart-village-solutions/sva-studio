import type { IamUserDetail } from '@sva/core';
import { z } from 'zod';

import type { QueryClient } from '../shared/db-helpers';

import { protectField } from './encryption';
import { getRoleExternalName } from './role-audit';
import { createUserSchema } from './schemas';
import {
  assignRoles,
  emitActivityLog,
  ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation,
  resolveRolesByIds,
} from './shared';
import { mapRoles } from './user-mapping';

export type CreateUserPayload = z.infer<typeof createUserSchema>;

type CreateUserActorInfo = {
  instanceId: string;
  actorAccountId: string;
  actorRoles?: readonly string[];
  requestId?: string;
  traceId?: string;
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

const buildDisplayName = (payload: CreateUserPayload, externalId: string): string =>
  payload.displayName ?? ([payload.firstName, payload.lastName].filter(Boolean).join(' ') || externalId);

const buildCreateAccountParams = (
  actor: CreateUserActorInfo,
  payload: CreateUserPayload,
  externalId: string
): readonly (string | null)[] => [
  actor.instanceId,
  externalId,
  protectField(payload.email, `iam.accounts.email:${externalId}`),
  protectField(buildDisplayName(payload, externalId), `iam.accounts.display_name:${externalId}`),
  protectField(payload.firstName, `iam.accounts.first_name:${externalId}`),
  protectField(payload.lastName, `iam.accounts.last_name:${externalId}`),
  protectField(payload.phone, `iam.accounts.phone:${externalId}`),
  payload.position ?? null,
  payload.department ?? null,
  payload.avatarUrl ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
  payload.status ?? 'pending',
  payload.notes ?? null,
];

const buildCreatedUserResponse = (
  accountId: string,
  externalId: string,
  payload: CreateUserPayload,
  roleNames: ReturnType<typeof mapRoles>
): IamUserDetail => ({
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
  roles: roleNames,
  mainserverUserApplicationSecretSet: false,
});

export const persistCreatedUser = async (
  client: QueryClient,
  input: {
    actor: CreateUserActorInfo;
    actorSubject: string;
    externalId: string;
    payload: CreateUserPayload;
  }
): Promise<{ responseData: IamUserDetail; roleNames: readonly string[] }> => {
  const { actor, actorSubject, externalId, payload } = input;
  const roleValidation = await ensureRoleAssignmentWithinActorLevel({
    client,
    instanceId: actor.instanceId,
    actorSubject,
    actorRoles: actor.actorRoles,
    roleIds: payload.roleIds,
  });
  if (!roleValidation.ok) {
    throw new Error(`${roleValidation.code}:${roleValidation.message}`);
  }

  const inserted = await client.query<{ id: string }>(
    INSERT_ACCOUNT_QUERY,
    buildCreateAccountParams(actor, payload, externalId)
  );
  const accountId = inserted.rows[0]?.id;
  if (!accountId) {
    throw new Error('conflict:Account konnte nicht erstellt werden.');
  }

  await client.query(INSERT_MEMBERSHIP_QUERY, [actor.instanceId, accountId]);
  await assignRoles(client, {
    instanceId: actor.instanceId,
    accountId,
    roleIds: payload.roleIds,
    assignedBy: actor.actorAccountId,
  });

  const assignedRoleRows = await resolveRolesByIds(client, {
    instanceId: actor.instanceId,
    roleIds: payload.roleIds,
  });

  await emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    subjectId: accountId,
    eventType: 'user.created',
    result: 'success',
    payload: {
      target_keycloak_subject: externalId,
      role_count: payload.roleIds.length,
    },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  await notifyPermissionInvalidation(client, {
    instanceId: actor.instanceId,
    keycloakSubject: externalId,
    trigger: 'user_role_changed',
  });

  return {
    responseData: buildCreatedUserResponse(accountId, externalId, payload, mapRoles(assignedRoleRows)),
    roleNames: assignedRoleRows.map((entry) => getRoleExternalName(entry)),
  };
};

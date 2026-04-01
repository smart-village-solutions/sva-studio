import type { IamUserDetail } from '@sva/core';
import type { z } from 'zod';

import type { QueryClient } from '../shared/db-helpers.js';

import { getRoleExternalName } from './role-audit.js';
import { updateUserSchema } from './schemas.js';
import {
  ensureActorCanManageTarget,
  ensureRoleAssignmentWithinActorLevel,
  resolveActorMaxRoleLevel,
  resolveGroupsByIds,
  resolveRoleIdsForGroups,
  resolveRolesByIds,
  resolveSystemAdminCount,
} from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';
import { hasSystemAdminRole } from './user-update-utils.js';

export type UpdateUserPayload = z.infer<typeof updateUserSchema>;

export type UserUpdatePlan = {
  existing: IamUserDetail;
  previousRoleNames: readonly string[];
  nextRoleNames?: readonly string[];
};

const resolveExternalRoleNames = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly string[]> => {
  const roles = await resolveRolesByIds(client, input);
  return roles.map((role) => getRoleExternalName(role));
};

const ensureActorCanUpdateTarget = (input: {
  actorMaxRoleLevel: number;
  actorRoles: readonly string[];
  targetRoles: IamUserDetail['roles'];
}): void => {
  const targetAccessCheck = ensureActorCanManageTarget(input);
  if (!targetAccessCheck.ok) {
    throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
  }
};

const ensureLastActiveSystemAdminRemains = async (
  client: QueryClient,
  instanceId: string
): Promise<void> => {
  const adminCount = await resolveSystemAdminCount(client, instanceId);
  if (adminCount <= 1) {
    throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
  }
};

const resolveNextRoleNames = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorSubject: string;
    actorRoles: readonly string[];
    existing: IamUserDetail;
    payload: UpdateUserPayload;
    actorIsSystemAdmin: boolean;
  }
): Promise<readonly string[] | undefined> => {
  if (!input.payload.roleIds) {
    return undefined;
  }

  if (!input.actorIsSystemAdmin) {
    const roleValidation = await ensureRoleAssignmentWithinActorLevel({
      client,
      instanceId: input.instanceId,
      actorSubject: input.actorSubject,
      actorRoles: input.actorRoles,
      roleIds: input.payload.roleIds,
    });
    if (!roleValidation.ok) {
      throw new Error(`${roleValidation.code}:${roleValidation.message}`);
    }
  }

  const assignedRoles = await resolveRolesByIds(client, {
    instanceId: input.instanceId,
    roleIds: input.payload.roleIds,
  });
  const nextRoleNames = assignedRoles.map((role) => getRoleExternalName(role));
  const wouldRemoveSystemAdmin =
    hasSystemAdminRole(input.existing.roles) &&
    !assignedRoles.some((role) => role.role_key === 'system_admin') &&
    (input.payload.status ?? input.existing.status) !== 'inactive';

  if (wouldRemoveSystemAdmin) {
    await ensureLastActiveSystemAdminRemains(client, input.instanceId);
  }

  return nextRoleNames;
};

const validateRequestedGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorSubject: string;
    actorRoles: readonly string[];
    payload: UpdateUserPayload;
    actorIsSystemAdmin: boolean;
  }
): Promise<void> => {
  if (!input.payload.groupIds) {
    return;
  }

  const uniqueGroupIds = [...new Set(input.payload.groupIds)];
  const groups = await resolveGroupsByIds(client, {
    instanceId: input.instanceId,
    groupIds: uniqueGroupIds,
  });
  if (groups.length !== uniqueGroupIds.length) {
    throw new Error('invalid_request:Mindestens eine aktive Gruppe existiert nicht.');
  }

  if (input.actorIsSystemAdmin) {
    return;
  }

  const bundledRoleIds = await resolveRoleIdsForGroups(client, {
    instanceId: input.instanceId,
    groupIds: uniqueGroupIds,
  });
  const roleValidation = await ensureRoleAssignmentWithinActorLevel({
    client,
    instanceId: input.instanceId,
    actorSubject: input.actorSubject,
    actorRoles: input.actorRoles,
    roleIds: bundledRoleIds,
  });
  if (!roleValidation.ok) {
    throw new Error(`${roleValidation.code}:${roleValidation.message}`);
  }
};

const ensureStatusChangeAllowed = async (
  client: QueryClient,
  input: {
    instanceId: string;
    existing: IamUserDetail;
    payload: UpdateUserPayload;
  }
): Promise<void> => {
  if (
    input.payload.status === 'inactive' &&
    input.existing.status === 'active' &&
    hasSystemAdminRole(input.existing.roles)
  ) {
    await ensureLastActiveSystemAdminRemains(client, input.instanceId);
  }
};

export const resolveUserUpdatePlan = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorSubject: string;
    actorRoles: readonly string[];
    userId: string;
    payload: UpdateUserPayload;
  }
): Promise<UserUpdatePlan | undefined> => {
  const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
    sessionRoleNames: input.actorRoles,
  });
  const existing = await resolveUserDetail(client, {
    instanceId: input.instanceId,
    userId: input.userId,
  });
  if (!existing) {
    return undefined;
  }

  const actorIsSystemAdmin = input.actorRoles.includes('system_admin');

  if (!actorIsSystemAdmin) {
    ensureActorCanUpdateTarget({
      actorMaxRoleLevel,
      actorRoles: input.actorRoles,
      targetRoles: existing.roles,
    });
  }

  const previousRoleNames = await resolveExternalRoleNames(client, {
    instanceId: input.instanceId,
    roleIds: existing.roles.map((role) => role.roleId),
  });

  const nextRoleNames = await resolveNextRoleNames(client, {
    instanceId: input.instanceId,
    actorSubject: input.actorSubject,
    actorRoles: input.actorRoles,
    existing,
    payload: input.payload,
    actorIsSystemAdmin,
  });
  await validateRequestedGroups(client, {
    instanceId: input.instanceId,
    actorSubject: input.actorSubject,
    actorRoles: input.actorRoles,
    payload: input.payload,
    actorIsSystemAdmin,
  });
  await ensureStatusChangeAllowed(client, {
    instanceId: input.instanceId,
    existing,
    payload: input.payload,
  });

  return {
    existing,
    previousRoleNames,
    nextRoleNames,
  };
};

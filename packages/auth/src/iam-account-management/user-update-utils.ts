import type { IamUserRoleAssignment } from '@sva/core';

import { protectField } from './encryption.js';

export const hasSystemAdminRole = (
  roles: readonly Pick<IamUserRoleAssignment, 'roleKey'>[]
): boolean => roles.some((role) => role.roleKey === 'system_admin');

export const buildUpdatedUserParams = (
  userId: string,
  instanceId: string,
  keycloakSubject: string,
  payload: {
    email?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    position?: string;
    department?: string;
    avatarUrl?: string;
    preferredLanguage?: string;
    timezone?: string;
    status?: 'active' | 'inactive' | 'pending';
    notes?: string;
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

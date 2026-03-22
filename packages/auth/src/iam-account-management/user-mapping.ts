import type { IamUserListItem, IamUserRoleAssignment } from '@sva/core';
import { revealField } from './encryption.js';
import { getRoleDisplayName } from './role-audit.js';
import type { IamRoleRow, UserStatus } from './types.js';

export const maskEmail = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) {
    return '***';
  }
  if (localPart.length <= 2) {
    return `***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
};

export const resolveUserDisplayName = (input: {
  decryptedDisplayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  keycloakSubject: string;
}): string => {
  const fullName = [input.firstName, input.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  if (input.decryptedDisplayName && input.decryptedDisplayName.trim().length > 0) {
    return input.decryptedDisplayName;
  }

  return fullName || input.keycloakSubject;
};

export const mapRoles = (roles: readonly IamRoleRow[]): readonly IamUserRoleAssignment[] =>
  roles.map((role) => ({
    roleId: role.id,
    roleKey: role.role_key,
    roleName: getRoleDisplayName(role),
    roleLevel: role.role_level,
    validFrom: role.valid_from ?? undefined,
    validTo: role.valid_to ?? undefined,
  }));

export const mapUserRowToListItem = (row: {
  id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext?: string | null;
  last_name_ciphertext?: string | null;
  email_ciphertext: string | null;
  position: string | null;
  department: string | null;
  status: UserStatus;
  last_login_at: string | null;
  roles: readonly IamRoleRow[];
}): IamUserListItem => {
  const decryptedDisplayName = revealField(
    row.display_name_ciphertext,
    `iam.accounts.display_name:${row.keycloak_subject}`
  );
  const firstName = revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`);
  const lastName = revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`);
  const displayName = resolveUserDisplayName({
    decryptedDisplayName,
    firstName,
    lastName,
    keycloakSubject: row.keycloak_subject,
  });
  const email = revealField(row.email_ciphertext, `iam.accounts.email:${row.keycloak_subject}`);
  return {
    id: row.id,
    keycloakSubject: row.keycloak_subject,
    displayName,
    email,
    status: row.status,
    position: row.position ?? undefined,
    department: row.department ?? undefined,
    lastLoginAt: row.last_login_at ?? undefined,
    roles: mapRoles(row.roles),
  };
};

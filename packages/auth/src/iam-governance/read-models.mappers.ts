import type { IamGovernanceCaseListItem } from '@sva/core';

import { readString } from '../shared/input-readers';
import { revealField } from '../iam-account-management/encryption';
import { resolveUserDisplayName } from '../iam-account-management/user-mapping';

import type {
  DelegationRow,
  GovernanceFilters,
  ImpersonationRow,
  LegalAcceptanceRow,
  PermissionChangeRow,
} from './read-models.types';

type PersonColumns = {
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  keycloak_subject: string;
};

const readPersonName = (person: PersonColumns): string =>
  resolveUserDisplayName({
    decryptedDisplayName: revealField(person.display_name_ciphertext, `iam.accounts.display_name:${person.keycloak_subject}`),
    firstName: revealField(person.first_name_ciphertext, `iam.accounts.first_name:${person.keycloak_subject}`),
    lastName: revealField(person.last_name_ciphertext, `iam.accounts.last_name:${person.keycloak_subject}`),
    keycloakSubject: person.keycloak_subject,
  });

const includesSearch = (value: string | undefined, search: string) =>
  Boolean(value?.toLowerCase().includes(search.toLowerCase()));

const matchesSearch = (item: IamGovernanceCaseListItem, search?: string) =>
  !search ||
  [
    item.title,
    item.summary,
    item.actorDisplayName,
    item.targetDisplayName,
    item.roleName,
    item.ticketId,
    item.status,
    item.type,
  ].some((value) => includesSearch(value, search));

const mapPermissionChangeRow = (row: PermissionChangeRow): IamGovernanceCaseListItem => {
  const actorDisplayName = readPersonName({
    display_name_ciphertext: row.requester_display_name_ciphertext,
    first_name_ciphertext: row.requester_first_name_ciphertext,
    last_name_ciphertext: row.requester_last_name_ciphertext,
    keycloak_subject: row.requester_keycloak_subject,
  });
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const roleName = row.role_display_name ?? row.role_name;

  return {
    id: row.id,
    type: 'permission_change',
    status: row.status,
    title: roleName,
    summary: `${actorDisplayName} -> ${targetDisplayName}`,
    actorAccountId: row.requester_account_id,
    actorDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    roleId: row.role_id,
    roleName,
    ticketId: row.ticket_id ?? undefined,
    ticketSystem: row.ticket_system ?? undefined,
    reasonCode: row.reason_code ?? undefined,
    createdAt: row.requested_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? undefined,
    resolvedAt: row.applied_at ?? undefined,
    metadata: {
      ticketState: row.ticket_state ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
    },
  };
};

const mapDelegationRow = (row: DelegationRow): IamGovernanceCaseListItem => {
  const actorDisplayName = readPersonName({
    display_name_ciphertext: row.delegator_display_name_ciphertext,
    first_name_ciphertext: row.delegator_first_name_ciphertext,
    last_name_ciphertext: row.delegator_last_name_ciphertext,
    keycloak_subject: row.delegator_keycloak_subject,
  });
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.delegatee_display_name_ciphertext,
    first_name_ciphertext: row.delegatee_first_name_ciphertext,
    last_name_ciphertext: row.delegatee_last_name_ciphertext,
    keycloak_subject: row.delegatee_keycloak_subject,
  });
  const roleName = row.role_display_name ?? row.role_name;

  return {
    id: row.id,
    type: 'delegation',
    status: row.status,
    title: roleName,
    summary: `${actorDisplayName} -> ${targetDisplayName}`,
    actorAccountId: row.delegator_account_id,
    actorDisplayName,
    targetAccountId: row.delegatee_account_id,
    targetDisplayName,
    roleId: row.role_id,
    roleName,
    ticketId: row.ticket_id ?? undefined,
    ticketSystem: row.ticket_system ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    resolvedAt: row.revoked_at ?? undefined,
    metadata: {
      ticketState: row.ticket_state ?? undefined,
    },
  };
};

const mapImpersonationRow = (row: ImpersonationRow): IamGovernanceCaseListItem => {
  const actorDisplayName = readPersonName({
    display_name_ciphertext: row.actor_display_name_ciphertext,
    first_name_ciphertext: row.actor_first_name_ciphertext,
    last_name_ciphertext: row.actor_last_name_ciphertext,
    keycloak_subject: row.actor_keycloak_subject,
  });
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });

  return {
    id: row.id,
    type: 'impersonation',
    status: row.status,
    title: 'impersonation',
    summary: `${actorDisplayName} -> ${targetDisplayName}`,
    actorAccountId: row.actor_account_id,
    actorDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    ticketId: row.ticket_id,
    ticketSystem: row.ticket_system,
    reasonCode: row.reason_code ?? undefined,
    createdAt: row.requested_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? undefined,
    startsAt: row.started_at ?? undefined,
    expiresAt: row.expires_at,
    resolvedAt: row.ended_at ?? undefined,
    metadata: {
      ticketState: row.ticket_state,
      terminationReason: row.termination_reason ?? undefined,
    },
  };
};

const mapLegalAcceptanceRow = (row: LegalAcceptanceRow): IamGovernanceCaseListItem => {
  const actorDisplayName = readPersonName({
    display_name_ciphertext: row.display_name_ciphertext,
    first_name_ciphertext: row.first_name_ciphertext,
    last_name_ciphertext: row.last_name_ciphertext,
    keycloak_subject: row.keycloak_subject,
  });

  return {
    id: row.id,
    type: 'legal_acceptance',
    status: row.revoked_at ? 'revoked' : 'accepted',
    title: row.legal_text_id,
    summary: actorDisplayName,
    actorAccountId: row.account_id,
    actorDisplayName,
    createdAt: row.accepted_at,
    resolvedAt: row.revoked_at ?? undefined,
    metadata: {
      legalTextVersion: row.legal_text_version,
      locale: row.locale,
      requestId: row.request_id ?? undefined,
      traceId: row.trace_id ?? undefined,
    },
  };
};

export const buildGovernanceItems = (rows: {
  permissionChanges: readonly PermissionChangeRow[];
  delegations: readonly DelegationRow[];
  impersonations: readonly ImpersonationRow[];
  legalAcceptances: readonly LegalAcceptanceRow[];
}): IamGovernanceCaseListItem[] => [
  ...rows.permissionChanges.map(mapPermissionChangeRow),
  ...rows.delegations.map(mapDelegationRow),
  ...rows.impersonations.map(mapImpersonationRow),
  ...rows.legalAcceptances.map(mapLegalAcceptanceRow),
];

export const filterGovernanceItems = (
  items: readonly IamGovernanceCaseListItem[],
  input: GovernanceFilters
): IamGovernanceCaseListItem[] =>
  items
    .filter((item) => (input.type ? item.type === input.type : true))
    .filter((item) => (input.status ? item.status === input.status : true))
    .filter((item) => matchesSearch(item, readString(input.search) ?? undefined))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const paginateGovernanceItems = (items: readonly IamGovernanceCaseListItem[], page: number, pageSize: number) => {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
};

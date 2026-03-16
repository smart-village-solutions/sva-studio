import type { IamGovernanceCaseListItem, IamGovernanceCaseType } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers';
import { readString } from '../shared/input-readers';
import { revealField } from '../iam-account-management/encryption';
import { resolveUserDisplayName } from '../iam-account-management/user-mapping';

type PersonColumns = {
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  keycloak_subject: string;
};

type GovernanceFilters = {
  readonly instanceId: string;
  readonly type?: IamGovernanceCaseType;
  readonly status?: string;
  readonly search?: string;
  readonly relatedAccountId?: string;
  readonly page: number;
  readonly pageSize: number;
};

type PermissionChangeRow = {
  id: string;
  status: string;
  ticket_id: string | null;
  ticket_system: string | null;
  ticket_state: string | null;
  reason_code: string | null;
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  applied_at: string | null;
  updated_at: string;
  role_id: string;
  role_name: string;
  role_display_name: string | null;
  requester_account_id: string;
  target_account_id: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

type DelegationRow = {
  id: string;
  status: string;
  ticket_id: string | null;
  ticket_system: string | null;
  ticket_state: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  role_id: string;
  role_name: string;
  role_display_name: string | null;
  delegator_account_id: string;
  delegatee_account_id: string;
  delegator_display_name_ciphertext: string | null;
  delegator_first_name_ciphertext: string | null;
  delegator_last_name_ciphertext: string | null;
  delegator_keycloak_subject: string;
  delegatee_display_name_ciphertext: string | null;
  delegatee_first_name_ciphertext: string | null;
  delegatee_last_name_ciphertext: string | null;
  delegatee_keycloak_subject: string;
};

type ImpersonationRow = {
  id: string;
  status: string;
  ticket_id: string;
  ticket_system: string;
  ticket_state: string;
  reason_code: string | null;
  termination_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
  updated_at: string;
  actor_account_id: string;
  target_account_id: string;
  actor_display_name_ciphertext: string | null;
  actor_first_name_ciphertext: string | null;
  actor_last_name_ciphertext: string | null;
  actor_keycloak_subject: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

type LegalAcceptanceRow = {
  id: string;
  legal_text_id: string;
  legal_text_version: string;
  locale: string;
  accepted_at: string;
  revoked_at: string | null;
  request_id: string | null;
  trace_id: string | null;
  account_id: string;
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

const matchesSearch = (item: IamGovernanceCaseListItem, search?: string) => {
  if (!search) {
    return true;
  }

  return [
    item.title,
    item.summary,
    item.actorDisplayName,
    item.targetDisplayName,
    item.roleName,
    item.ticketId,
    item.status,
    item.type,
  ].some((value) => includesSearch(value, search));
};

const paginate = <T>(items: readonly T[], page: number, pageSize: number) => {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
};

export const listGovernanceCases = async (
  client: QueryClient,
  input: GovernanceFilters
): Promise<{ items: readonly IamGovernanceCaseListItem[]; total: number }> => {
  const [permissionChanges, delegations, impersonations, legalAcceptances] = await Promise.all([
    client.query<PermissionChangeRow>(
      `
SELECT
  request.id,
  request.status,
  request.ticket_id,
  request.ticket_system,
  request.ticket_state,
  request.reason_code,
  request.rejection_reason,
  request.requested_at::text,
  request.approved_at::text,
  request.applied_at::text,
  request.updated_at::text,
  role.id AS role_id,
  role.role_name,
  role.display_name AS role_display_name,
  requester.id AS requester_account_id,
  target.id AS target_account_id,
  requester.display_name_ciphertext AS requester_display_name_ciphertext,
  requester.first_name_ciphertext AS requester_first_name_ciphertext,
  requester.last_name_ciphertext AS requester_last_name_ciphertext,
  requester.keycloak_subject AS requester_keycloak_subject,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject
FROM iam.permission_change_requests request
JOIN iam.roles role
  ON role.instance_id = request.instance_id
 AND role.id = request.role_id
JOIN iam.accounts requester
  ON requester.id = request.requester_account_id
JOIN iam.accounts target
  ON target.id = request.target_account_id
WHERE request.instance_id = $1
  AND ($2::uuid IS NULL OR request.requester_account_id = $2::uuid OR request.target_account_id = $2::uuid)
ORDER BY request.requested_at DESC;
`,
      [input.instanceId, input.relatedAccountId ?? null]
    ),
    client.query<DelegationRow>(
      `
SELECT
  delegation.id,
  delegation.status,
  delegation.ticket_id,
  delegation.ticket_system,
  delegation.ticket_state,
  delegation.starts_at::text,
  delegation.ends_at::text,
  delegation.created_at::text,
  delegation.updated_at::text,
  delegation.revoked_at::text,
  role.id AS role_id,
  role.role_name,
  role.display_name AS role_display_name,
  delegator.id AS delegator_account_id,
  delegatee.id AS delegatee_account_id,
  delegator.display_name_ciphertext AS delegator_display_name_ciphertext,
  delegator.first_name_ciphertext AS delegator_first_name_ciphertext,
  delegator.last_name_ciphertext AS delegator_last_name_ciphertext,
  delegator.keycloak_subject AS delegator_keycloak_subject,
  delegatee.display_name_ciphertext AS delegatee_display_name_ciphertext,
  delegatee.first_name_ciphertext AS delegatee_first_name_ciphertext,
  delegatee.last_name_ciphertext AS delegatee_last_name_ciphertext,
  delegatee.keycloak_subject AS delegatee_keycloak_subject
FROM iam.delegations delegation
JOIN iam.roles role
  ON role.instance_id = delegation.instance_id
 AND role.id = delegation.role_id
JOIN iam.accounts delegator
  ON delegator.id = delegation.delegator_account_id
JOIN iam.accounts delegatee
  ON delegatee.id = delegation.delegatee_account_id
WHERE delegation.instance_id = $1
  AND ($2::uuid IS NULL OR delegation.delegator_account_id = $2::uuid OR delegation.delegatee_account_id = $2::uuid)
ORDER BY delegation.created_at DESC;
`,
      [input.instanceId, input.relatedAccountId ?? null]
    ),
    client.query<ImpersonationRow>(
      `
SELECT
  session.id,
  session.status,
  session.ticket_id,
  session.ticket_system,
  session.ticket_state,
  session.reason_code,
  session.termination_reason,
  session.requested_at::text,
  session.approved_at::text,
  session.started_at::text,
  session.ended_at::text,
  session.expires_at::text,
  session.updated_at::text,
  actor.id AS actor_account_id,
  target.id AS target_account_id,
  actor.display_name_ciphertext AS actor_display_name_ciphertext,
  actor.first_name_ciphertext AS actor_first_name_ciphertext,
  actor.last_name_ciphertext AS actor_last_name_ciphertext,
  actor.keycloak_subject AS actor_keycloak_subject,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject
FROM iam.impersonation_sessions session
JOIN iam.accounts actor
  ON actor.id = session.actor_account_id
JOIN iam.accounts target
  ON target.id = session.target_account_id
WHERE session.instance_id = $1
  AND ($2::uuid IS NULL OR session.actor_account_id = $2::uuid OR session.target_account_id = $2::uuid)
ORDER BY session.requested_at DESC;
`,
      [input.instanceId, input.relatedAccountId ?? null]
    ),
    client.query<LegalAcceptanceRow>(
      `
SELECT
  acceptance.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  acceptance.accepted_at::text,
  acceptance.revoked_at::text,
  acceptance.request_id,
  acceptance.trace_id,
  account.id AS account_id,
  account.display_name_ciphertext,
  account.first_name_ciphertext,
  account.last_name_ciphertext,
  account.keycloak_subject
FROM iam.legal_text_acceptances acceptance
JOIN iam.legal_text_versions version
  ON version.id = acceptance.legal_text_version_id
JOIN iam.accounts account
  ON account.id = acceptance.account_id
WHERE acceptance.instance_id = $1
  AND ($2::uuid IS NULL OR acceptance.account_id = $2::uuid)
ORDER BY acceptance.accepted_at DESC;
`,
      [input.instanceId, input.relatedAccountId ?? null]
    ),
  ]);

  const permissionItems: IamGovernanceCaseListItem[] = permissionChanges.rows.map((row) => {
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
    });
  const delegationItems: IamGovernanceCaseListItem[] = delegations.rows.map((row) => {
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
    });
  const impersonationItems: IamGovernanceCaseListItem[] = impersonations.rows.map((row) => {
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
    });
  const legalAcceptanceItems: IamGovernanceCaseListItem[] = legalAcceptances.rows.map((row) => {
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
    });

  const items: IamGovernanceCaseListItem[] = [
    ...permissionItems,
    ...delegationItems,
    ...impersonationItems,
    ...legalAcceptanceItems,
  ]
    .filter((item) => (input.type ? item.type === input.type : true))
    .filter((item) => (input.status ? item.status === input.status : true))
    .filter((item) => matchesSearch(item, readString(input.search) ?? undefined))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    items: paginate(items, input.page, input.pageSize),
    total: items.length,
  };
};

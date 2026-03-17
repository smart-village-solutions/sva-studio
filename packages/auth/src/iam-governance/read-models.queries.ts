import type { QueryClient } from '../shared/db-helpers';
import type {
  DelegationRow,
  GovernanceFilters,
  ImpersonationRow,
  LegalAcceptanceRow,
  PermissionChangeRow,
} from './read-models.types';

const queryPermissionChanges = (client: QueryClient, input: GovernanceFilters) =>
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
  );

const queryDelegations = (client: QueryClient, input: GovernanceFilters) =>
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
  );

const queryImpersonations = (client: QueryClient, input: GovernanceFilters) =>
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
  );

const queryLegalAcceptances = (client: QueryClient, input: GovernanceFilters) =>
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
  );

export const loadGovernanceSourceRows = async (client: QueryClient, input: GovernanceFilters) => {
  const [permissionChanges, delegations, impersonations, legalAcceptances] = await Promise.all([
    queryPermissionChanges(client, input),
    queryDelegations(client, input),
    queryImpersonations(client, input),
    queryLegalAcceptances(client, input),
  ]);

  return {
    permissionChanges: permissionChanges.rows,
    delegations: delegations.rows,
    impersonations: impersonations.rows,
    legalAcceptances: legalAcceptances.rows,
  };
};

import type { QueryClient } from './query-client.js';

export const loadMembershipRows = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
) => {
  const orgRows = await client.query<{
    id: string;
    organization_key: string;
    display_name: string;
  }>(
    `
SELECT o.id, o.organization_key, o.display_name
FROM iam.account_organizations ao
JOIN iam.organizations o
  ON o.instance_id = ao.instance_id
 AND o.id = ao.organization_id
WHERE ao.instance_id = $1
  AND ao.account_id = $2::uuid
ORDER BY o.display_name ASC;
`,
    [input.instanceId, input.accountId]
  );

  const roleRows = await client.query<{
    id: string;
    role_name: string;
    description: string | null;
  }>(
    `
SELECT r.id, r.role_name, r.description
FROM iam.account_roles ar
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ar.instance_id = $1
  AND ar.account_id = $2::uuid
ORDER BY r.role_name ASC;
`,
    [input.instanceId, input.accountId]
  );

  return { orgRows, roleRows };
};

export const loadGovernanceRows = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
) => {
  const holdRows = await client.query<{
    id: string;
    active: boolean;
    hold_reason: string;
    hold_until: string | null;
    created_at: string;
  }>(
    `
SELECT id, active, hold_reason, hold_until, created_at
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
ORDER BY created_at DESC
LIMIT 20;
`,
    [input.instanceId, input.accountId]
  );

  const groupRows = await client.query<{
    group_id: string;
    group_key: string;
    display_name: string;
    group_type: string;
    origin: string;
    valid_from: string | null;
    valid_until: string | null;
  }>(
    `
SELECT
  g.id AS group_id,
  g.group_key,
  g.display_name,
  g.group_type,
  ag.origin,
  ag.valid_from::text,
  ag.valid_until::text
FROM iam.account_groups ag
JOIN iam.groups g
  ON g.instance_id = ag.instance_id
 AND g.id = ag.group_id
WHERE ag.instance_id = $1
  AND ag.account_id = $2::uuid
  AND g.is_active = true
  AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
  AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
ORDER BY g.display_name ASC, g.group_key ASC;
`,
    [input.instanceId, input.accountId]
  );

  return { holdRows, groupRows };
};

export const loadLegalRows = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
) => {
  const requestRows = await client.query<{
    id: string;
    request_type: string;
    status: string;
    request_accepted_at: string;
    completed_at: string | null;
  }>(
    `
SELECT id, request_type, status, request_accepted_at, completed_at
FROM iam.data_subject_requests
WHERE instance_id = $1
  AND target_account_id = $2::uuid
ORDER BY request_accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.accountId]
  );

  const legalAcceptanceRows = await client.query<{
    id: string;
    legal_text_id: string;
    legal_text_version: string;
    name: string;
    locale: string;
    accepted_at: string;
    revoked_at: string | null;
    action_type: string | null;
  }>(
    `
SELECT
  lta.id,
  ltv.legal_text_id,
  ltv.legal_text_version,
  ltv.name,
  ltv.locale,
  lta.accepted_at::text,
  lta.revoked_at::text,
  lta.action_type
FROM iam.legal_text_acceptances lta
JOIN iam.legal_text_versions ltv
  ON ltv.id = lta.legal_text_version_id
 AND ltv.instance_id = lta.instance_id
WHERE lta.instance_id = $1
  AND lta.account_id = $2::uuid
ORDER BY lta.accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.accountId]
  );

  return { requestRows, legalAcceptanceRows };
};

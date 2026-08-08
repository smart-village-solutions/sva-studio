import { withInstanceScopedDb } from '../iam-account-management/shared.js';

export type MainserverMutationProviderOutcome = 'failed' | 'pending' | 'succeeded' | 'unknown';
export type MainserverMutationReconciliationStatus =
  'complete' | 'failed' | 'pending' | 'reconciliation_required';
export type MainserverMutationResolverMode = 'automatic' | 'compatibility' | 'shadow';

export type MainserverMutationJournalEntry = Readonly<{
  id: string;
  operationExternalId: string;
  actionId?: string;
  contentType?: string;
  contentId?: string;
  observedDataProviderId?: string;
  authorizationMode?: 'credential_visible_compatibility' | 'exact';
  resolverMode?: MainserverMutationResolverMode;
  candidateAuthorizationMode?: 'credential_visible_compatibility' | 'exact';
  candidateAllowed?: boolean;
  shadowDifference?: boolean;
  providerOutcome: MainserverMutationProviderOutcome;
  reconciliationStatus: MainserverMutationReconciliationStatus;
  attemptCount: number;
  completedSteps: readonly string[];
  completedAt?: string;
}>;

type JournalRow = Readonly<{
  id: string;
  operation_external_id: string;
  action_id?: string;
  content_type?: string;
  content_id?: string | null;
  observed_data_provider_id?: string | null;
  authorization_mode?: 'credential_visible_compatibility' | 'exact';
  resolver_mode?: MainserverMutationResolverMode;
  candidate_authorization_mode?: 'credential_visible_compatibility' | 'exact' | null;
  candidate_allowed?: boolean | null;
  shadow_difference?: boolean;
  provider_outcome: MainserverMutationProviderOutcome;
  reconciliation_status: MainserverMutationReconciliationStatus;
  attempt_count: number;
  completed_steps: unknown;
  completed_at: string | null;
}>;

const columns = `
  id::text,
  operation_external_id,
  action_id,
  content_type,
  content_id,
  observed_data_provider_id,
  authorization_mode,
  resolver_mode,
  candidate_authorization_mode,
  candidate_allowed,
  shadow_difference,
  provider_outcome,
  reconciliation_status,
  attempt_count,
  completed_steps,
  completed_at::text
`;

const mapEntry = (row: JournalRow): MainserverMutationJournalEntry => ({
  id: row.id,
  operationExternalId: row.operation_external_id,
  ...(row.action_id ? { actionId: row.action_id } : {}),
  ...(row.content_type ? { contentType: row.content_type } : {}),
  ...(row.content_id ? { contentId: row.content_id } : {}),
  ...(row.observed_data_provider_id
    ? { observedDataProviderId: row.observed_data_provider_id }
    : {}),
  ...(row.authorization_mode ? { authorizationMode: row.authorization_mode } : {}),
  ...(row.resolver_mode ? { resolverMode: row.resolver_mode } : {}),
  ...(row.candidate_authorization_mode
    ? { candidateAuthorizationMode: row.candidate_authorization_mode }
    : {}),
  ...(typeof row.candidate_allowed === 'boolean'
    ? { candidateAllowed: row.candidate_allowed }
    : {}),
  ...(typeof row.shadow_difference === 'boolean'
    ? { shadowDifference: row.shadow_difference }
    : {}),
  providerOutcome: row.provider_outcome,
  reconciliationStatus: row.reconciliation_status,
  attemptCount: row.attempt_count,
  completedSteps: Array.isArray(row.completed_steps)
    ? row.completed_steps.filter((entry): entry is string => typeof entry === 'string')
    : [],
  ...(row.completed_at ? { completedAt: row.completed_at } : {}),
});

const required = (value: string, code: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
};

export const beginMainserverMutationJournal = async (input: {
  readonly instanceId: string;
  readonly operationExternalId: string;
  readonly actorAccountId?: string;
  readonly actingPrincipalType: 'organization' | 'user';
  readonly actingPrincipalId: string;
  readonly activeOrganizationId?: string;
  readonly credentialSource: 'organization' | 'user';
  readonly credentialFingerprint: string;
  readonly actionId: string;
  readonly contentType: string;
  readonly contentId?: string;
  readonly expectedDataProviderId?: string;
  readonly observedDataProviderId?: string;
  readonly authorizationMode: 'credential_visible_compatibility' | 'exact';
  readonly resolverMode: MainserverMutationResolverMode;
  readonly candidateAuthorizationMode?: 'credential_visible_compatibility' | 'exact';
  readonly candidateAllowed?: boolean;
  readonly shadowDifference?: boolean;
  readonly preimage?: Readonly<Record<string, unknown>>;
}): Promise<MainserverMutationJournalEntry> => {
  const operationExternalId = required(
    input.operationExternalId,
    'mainserver_operation_external_id_required'
  );
  const actingPrincipalId = required(
    input.actingPrincipalId,
    'mainserver_acting_principal_id_required'
  );
  const credentialFingerprint = required(
    input.credentialFingerprint,
    'mainserver_credential_fingerprint_required'
  );
  const actionId = required(input.actionId, 'mainserver_action_id_required');
  const contentType = required(input.contentType, 'mainserver_content_type_required');

  return withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<JournalRow>(
      `
INSERT INTO iam.mainserver_mutation_journal (
  instance_id, operation_external_id, actor_account_id, acting_principal_type,
  acting_principal_id, active_organization_id, credential_source,
  credential_fingerprint, action_id, content_type, content_id,
  expected_data_provider_id, observed_data_provider_id, authorization_mode,
  resolver_mode, candidate_authorization_mode, candidate_allowed, shadow_difference,
  preimage, completed_steps
)
VALUES (
  $1, $2, $3::uuid, $4, $5::uuid, $6::uuid, $7, $8, $9, $10, $11, $12, $13, $14,
  $15, $16, $17, $18, $19::jsonb, '["authorized"]'::jsonb
)
ON CONFLICT ON CONSTRAINT mainserver_mutation_journal_operation_key
DO UPDATE SET
  attempt_count = iam.mainserver_mutation_journal.attempt_count + 1,
  provider_outcome = CASE
    WHEN iam.mainserver_mutation_journal.provider_outcome = 'pending' THEN 'unknown'
    ELSE iam.mainserver_mutation_journal.provider_outcome
  END,
  reconciliation_status = CASE
    WHEN iam.mainserver_mutation_journal.provider_outcome = 'pending' THEN 'reconciliation_required'
    ELSE iam.mainserver_mutation_journal.reconciliation_status
  END,
  updated_at = NOW(),
  expected_data_provider_id = COALESCE(iam.mainserver_mutation_journal.expected_data_provider_id, EXCLUDED.expected_data_provider_id),
  observed_data_provider_id = COALESCE(iam.mainserver_mutation_journal.observed_data_provider_id, EXCLUDED.observed_data_provider_id),
  preimage = COALESCE(iam.mainserver_mutation_journal.preimage, EXCLUDED.preimage)
RETURNING ${columns};
      `,
      [
        input.instanceId,
        operationExternalId,
        input.actorAccountId ?? null,
        input.actingPrincipalType,
        actingPrincipalId,
        input.activeOrganizationId ?? null,
        input.credentialSource,
        credentialFingerprint,
        actionId,
        contentType,
        input.contentId ?? null,
        input.expectedDataProviderId ?? null,
        input.observedDataProviderId ?? null,
        input.authorizationMode,
        input.resolverMode,
        input.candidateAuthorizationMode ?? null,
        input.candidateAllowed ?? null,
        input.shadowDifference ?? false,
        input.preimage ? JSON.stringify(input.preimage) : null,
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('mainserver_mutation_journal_write_failed');
    return mapEntry(row);
  });
};

export const finalizeMainserverMutationJournal = async (input: {
  readonly instanceId: string;
  readonly operationExternalId: string;
  readonly providerOutcome: Exclude<MainserverMutationProviderOutcome, 'pending'>;
  readonly reconciliationStatus: Exclude<MainserverMutationReconciliationStatus, 'pending'>;
  readonly completedSteps: readonly string[];
  readonly observedDataProviderId?: string;
  readonly contentId?: string;
  readonly lastErrorCode?: string;
}): Promise<MainserverMutationJournalEntry | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<JournalRow>(
      `
UPDATE iam.mainserver_mutation_journal
SET
  provider_outcome = CASE WHEN provider_outcome = 'succeeded' THEN provider_outcome ELSE $3 END,
  reconciliation_status = CASE
    WHEN provider_outcome = 'succeeded' AND reconciliation_status = 'complete' THEN reconciliation_status
    ELSE $4
  END,
  completed_steps = (
    SELECT COALESCE(jsonb_agg(step ORDER BY step), '[]'::jsonb)
    FROM (
      SELECT DISTINCT jsonb_array_elements_text(completed_steps || $5::jsonb) AS step
    ) AS distinct_steps
  ),
  observed_data_provider_id = COALESCE(observed_data_provider_id, $6),
  content_id = COALESCE(content_id, $7),
  last_error_code = $8,
  completed_at = CASE WHEN $3 = 'succeeded' AND $4 = 'complete' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
  updated_at = NOW()
WHERE instance_id = $1 AND operation_external_id = $2
RETURNING ${columns};
      `,
      [
        input.instanceId,
        required(input.operationExternalId, 'mainserver_operation_external_id_required'),
        input.providerOutcome,
        input.reconciliationStatus,
        JSON.stringify([...new Set(input.completedSteps)]),
        input.observedDataProviderId ?? null,
        input.contentId ?? null,
        input.lastErrorCode ?? null,
      ]
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : undefined;
  });

export const loadMainserverMutationJournal = async (input: {
  readonly instanceId: string;
  readonly operationExternalId: string;
}): Promise<MainserverMutationJournalEntry | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<JournalRow>(
      `SELECT ${columns}
       FROM iam.mainserver_mutation_journal
       WHERE instance_id = $1 AND operation_external_id = $2
       LIMIT 1;`,
      [input.instanceId, input.operationExternalId]
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : undefined;
  });

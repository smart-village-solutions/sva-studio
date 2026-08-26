import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import type {
  MainserverDataProviderBinding,
  MainserverDataProviderBindingStatus,
  MainserverDataProviderEvidenceKind,
  MainserverPrincipalType,
} from './mainserver-data-provider-bindings.js';
import { lockMainserverDataProviderBindingScope } from './mainserver-data-provider-binding-lock.js';
import { loadHardDeleteEvidence } from './mainserver-data-provider-hard-delete-evidence.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

type BindingRow = Readonly<{
  id: string;
  instance_id: string;
  principal_type: MainserverPrincipalType;
  principal_id: string;
  credential_fingerprint: string;
  data_provider_id: string;
  data_provider_name: string | null;
  status: MainserverDataProviderBindingStatus;
  evidence_kind: MainserverDataProviderEvidenceKind;
  first_observed_at: string;
  last_observed_at: string;
  superseded_at: string | null;
}>;

type AccountLifecycleRow = Readonly<{
  id: string;
  deletion_lifecycle_state: 'active' | 'deactivated' | 'deleted' | 'pseudonymized';
  is_blocked: boolean;
  soft_deleted_at: string | null;
  permanently_deleted_at: string | null;
}>;

type ReconciliationInput = Readonly<{
  instanceId: string;
  principalType: MainserverPrincipalType;
  principalId: string;
  credentialFingerprint: string;
  dataProviderId: string;
}>;

export type DeletedUserDataProviderConflictReason =
  | 'competing_principal_not_user'
  | 'competing_user_not_permanently_deleted'
  | 'current_credential_provider_mismatch'
  | 'current_user_not_active'
  | 'exact_binding_missing'
  | 'no_permanently_deleted_competitor'
  | 'unsupported_current_principal';

export type ReconcileDeletedUserDataProviderConflictResult =
  | Readonly<{
      outcome: 'resolved';
      binding: MainserverDataProviderBinding;
      historicalBindingCount: number;
    }>
  | Readonly<{
      outcome: 'not_resolved';
      reason: DeletedUserDataProviderConflictReason;
    }>;

type ReconciliationDecision =
  | ReconcileDeletedUserDataProviderConflictResult
  | Readonly<{
      outcome: 'ready';
      exactBinding: BindingRow;
      historicalBindingIds: readonly string[];
    }>;

const bindingColumns = `
  id::text,
  instance_id,
  principal_type,
  principal_id::text,
  credential_fingerprint,
  data_provider_id,
  data_provider_name,
  status,
  evidence_kind,
  first_observed_at::text,
  last_observed_at::text,
  superseded_at::text
`;

const mapBinding = (row: BindingRow): MainserverDataProviderBinding => ({
  id: row.id,
  instanceId: row.instance_id,
  principalType: row.principal_type,
  principalId: row.principal_id,
  credentialFingerprint: row.credential_fingerprint,
  dataProviderId: row.data_provider_id,
  ...(row.data_provider_name ? { dataProviderName: row.data_provider_name } : {}),
  status: row.status,
  evidenceKind: row.evidence_kind,
  firstObservedAt: row.first_observed_at,
  lastObservedAt: row.last_observed_at,
  ...(row.superseded_at ? { supersededAt: row.superseded_at } : {}),
});

const normalizeInput = (input: ReconciliationInput): ReconciliationInput => {
  const principalId = input.principalId.trim();
  const credentialFingerprint = input.credentialFingerprint.trim();
  const dataProviderId = input.dataProviderId.trim();
  if (!principalId) throw new Error('mainserver_principal_id_required');
  if (!credentialFingerprint) throw new Error('mainserver_credential_fingerprint_required');
  if (!dataProviderId) throw new Error('mainserver_data_provider_id_required');
  return { ...input, principalId, credentialFingerprint, dataProviderId };
};

const isExactBinding = (row: BindingRow, input: ReconciliationInput): boolean =>
  row.principal_type === input.principalType &&
  row.principal_id === input.principalId &&
  row.credential_fingerprint === input.credentialFingerprint &&
  row.data_provider_id === input.dataProviderId;

const loadRelatedBindings = async (
  client: InstanceScopedClient,
  input: ReconciliationInput
): Promise<readonly BindingRow[]> => {
  await lockMainserverDataProviderBindingScope(client, input);
  const result = await client.query<BindingRow>(
    `
SELECT ${bindingColumns}
FROM iam.mainserver_data_provider_bindings
WHERE instance_id = $1
  AND status IN ('verified', 'conflict')
  AND (
    (principal_type = $2 AND principal_id = $3::uuid AND credential_fingerprint = $4)
    OR data_provider_id = $5
  )
FOR UPDATE;
`,
    [
      input.instanceId,
      input.principalType,
      input.principalId,
      input.credentialFingerprint,
      input.dataProviderId,
    ]
  );
  return result.rows;
};

const loadUserAccounts = async (
  client: InstanceScopedClient,
  instanceId: string,
  bindings: readonly BindingRow[]
): Promise<ReadonlyMap<string, AccountLifecycleRow>> => {
  const userPrincipalIds = [
    ...new Set(
      bindings.filter((row) => row.principal_type === 'user').map((row) => row.principal_id)
    ),
  ];
  const result = await client.query<AccountLifecycleRow>(
    `
SELECT
  id::text,
  deletion_lifecycle_state,
  is_blocked,
  soft_deleted_at::text,
  permanently_deleted_at::text
FROM iam.accounts
WHERE instance_id = $1
  AND id = ANY($2::uuid[])
FOR UPDATE;
`,
    [instanceId, userPrincipalIds]
  );
  return new Map(result.rows.map((account) => [account.id, account]));
};

const isCurrentActiveUser = (account: AccountLifecycleRow | undefined): boolean =>
  account?.deletion_lifecycle_state === 'active' &&
  account.is_blocked === false &&
  account.soft_deleted_at === null &&
  account.permanently_deleted_at === null;

const isPermanentlyDeletedUser = (
  principalId: string,
  account: AccountLifecycleRow | undefined,
  hardDeletedUserIds: ReadonlySet<string>
): boolean =>
  account
    ? account.deletion_lifecycle_state === 'deleted' || account.permanently_deleted_at !== null
    : hardDeletedUserIds.has(principalId);

const decideReconciliation = (
  input: ReconciliationInput,
  bindings: readonly BindingRow[],
  accounts: ReadonlyMap<string, AccountLifecycleRow>,
  hardDeletedUserIds: ReadonlySet<string>
): ReconciliationDecision => {
  const exactBinding = bindings.find((row) => isExactBinding(row, input));
  if (!exactBinding) return { outcome: 'not_resolved', reason: 'exact_binding_missing' };
  if (!isCurrentActiveUser(accounts.get(input.principalId))) {
    return { outcome: 'not_resolved', reason: 'current_user_not_active' };
  }
  const credentialMismatch = bindings.some(
    (row) =>
      row.principal_type === input.principalType &&
      row.principal_id === input.principalId &&
      row.credential_fingerprint === input.credentialFingerprint &&
      row.data_provider_id !== input.dataProviderId
  );
  if (credentialMismatch) {
    return { outcome: 'not_resolved', reason: 'current_credential_provider_mismatch' };
  }
  const competitors = bindings.filter(
    (row) =>
      row.data_provider_id === input.dataProviderId &&
      (row.principal_type !== input.principalType || row.principal_id !== input.principalId)
  );
  if (competitors.length === 0) {
    return exactBinding.status === 'verified'
      ? { outcome: 'resolved', binding: mapBinding(exactBinding), historicalBindingCount: 0 }
      : { outcome: 'not_resolved', reason: 'no_permanently_deleted_competitor' };
  }
  if (competitors.some((row) => row.principal_type !== 'user')) {
    return { outcome: 'not_resolved', reason: 'competing_principal_not_user' };
  }
  if (
    competitors.some(
      (row) =>
        !isPermanentlyDeletedUser(
          row.principal_id,
          accounts.get(row.principal_id),
          hardDeletedUserIds
        )
    )
  ) {
    return { outcome: 'not_resolved', reason: 'competing_user_not_permanently_deleted' };
  }
  return {
    outcome: 'ready',
    exactBinding,
    historicalBindingIds: [...new Set(competitors.map((row) => row.id))],
  };
};

const persistReconciliation = async (
  client: InstanceScopedClient,
  input: ReconciliationInput,
  decision: Extract<ReconciliationDecision, { outcome: 'ready' }>
): Promise<ReconcileDeletedUserDataProviderConflictResult> => {
  await client.query(
    `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'historical', superseded_at = NOW(), last_observed_at = NOW()
WHERE instance_id = $1
  AND id = ANY($2::uuid[])
  AND status IN ('verified', 'conflict');
`,
    [input.instanceId, decision.historicalBindingIds]
  );
  const result = await client.query<BindingRow>(
    `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'verified', superseded_at = NULL, last_observed_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
  AND status IN ('verified', 'conflict')
RETURNING ${bindingColumns};
`,
    [input.instanceId, decision.exactBinding.id]
  );
  const verifiedBinding = result.rows[0];
  if (!verifiedBinding) {
    throw new Error('mainserver_data_provider_binding_reconciliation_write_failed');
  }
  return {
    outcome: 'resolved',
    binding: mapBinding(verifiedBinding),
    historicalBindingCount: decision.historicalBindingIds.length,
  };
};

export const reconcileDeletedUserDataProviderConflict = async (
  rawInput: ReconciliationInput
): Promise<ReconcileDeletedUserDataProviderConflictResult> => {
  const input = normalizeInput(rawInput);
  if (input.principalType !== 'user') {
    return { outcome: 'not_resolved', reason: 'unsupported_current_principal' };
  }
  return withInstanceScopedDb(input.instanceId, async (client) => {
    const bindings = await loadRelatedBindings(client, input);
    if (!bindings.some((row) => isExactBinding(row, input))) {
      return { outcome: 'not_resolved', reason: 'exact_binding_missing' };
    }
    const accounts = await loadUserAccounts(client, input.instanceId, bindings);
    const missingUserIds = bindings
      .filter((row) => row.principal_type === 'user' && !accounts.has(row.principal_id))
      .map((row) => row.principal_id);
    const hardDeletedUserIds = await loadHardDeleteEvidence(
      client,
      input.instanceId,
      missingUserIds
    );
    const decision = decideReconciliation(input, bindings, accounts, hardDeletedUserIds);
    return decision.outcome === 'ready' ? persistReconciliation(client, input, decision) : decision;
  });
};

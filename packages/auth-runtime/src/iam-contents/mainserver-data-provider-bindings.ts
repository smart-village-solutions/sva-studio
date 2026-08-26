import { withInstanceScopedDb } from '../iam-account-management/shared.js';
type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export type MainserverPrincipalType = 'organization' | 'user';
export type MainserverDataProviderBindingStatus =
  'pending' | 'verified' | 'conflict' | 'historical' | 'revoked';
export type MainserverDataProviderEvidenceKind =
  'create_response' | 'create_reread' | 'identity_endpoint';

export type MainserverDataProviderBinding = Readonly<{
  id: string;
  instanceId: string;
  principalType: MainserverPrincipalType;
  principalId: string;
  credentialFingerprint: string;
  dataProviderId: string;
  dataProviderName?: string;
  status: MainserverDataProviderBindingStatus;
  evidenceKind: MainserverDataProviderEvidenceKind;
  firstObservedAt: string;
  lastObservedAt: string;
  supersededAt?: string;
}>;

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

const normalizeRequiredText = (value: string, errorCode: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(errorCode);
  }
  return normalized;
};

const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export type RecordMainserverDataProviderObservationResult = Readonly<{
  binding: MainserverDataProviderBinding;
  outcome: 'created' | 'confirmed' | 'conflict';
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

type DataProviderObservation = Readonly<{
  instanceId: string;
  principalType: MainserverPrincipalType;
  principalId: string;
  credentialFingerprint: string;
  dataProviderId: string;
  dataProviderName?: string;
  evidenceKind: MainserverDataProviderEvidenceKind;
}>;

type AccountLifecycleRow = Readonly<{
  id: string;
  deletion_lifecycle_state: 'active' | 'deactivated' | 'deleted' | 'pseudonymized';
  is_blocked: boolean;
  soft_deleted_at: string | null;
  permanently_deleted_at: string | null;
}>;

const normalizeObservation = (input: DataProviderObservation): DataProviderObservation => ({
  ...input,
  principalId: normalizeRequiredText(input.principalId, 'mainserver_principal_id_required'),
  credentialFingerprint: normalizeRequiredText(
    input.credentialFingerprint,
    'mainserver_credential_fingerprint_required'
  ),
  dataProviderId: normalizeRequiredText(
    input.dataProviderId,
    'mainserver_data_provider_id_required'
  ),
  ...(normalizeOptionalText(input.dataProviderName)
    ? { dataProviderName: normalizeOptionalText(input.dataProviderName) }
    : {}),
});

const isExactObservation = (row: BindingRow, input: DataProviderObservation): boolean =>
  row.principal_type === input.principalType &&
  row.principal_id === input.principalId &&
  row.credential_fingerprint === input.credentialFingerprint &&
  row.data_provider_id === input.dataProviderId;

const observationConflicts = (
  rows: readonly BindingRow[],
  input: DataProviderObservation
): boolean =>
  rows.some(
    (row) =>
      (row.principal_type === input.principalType &&
        row.principal_id === input.principalId &&
        row.credential_fingerprint === input.credentialFingerprint &&
        row.data_provider_id !== input.dataProviderId) ||
      (row.data_provider_id === input.dataProviderId &&
        (row.principal_type !== input.principalType || row.principal_id !== input.principalId))
  );

const updateRelatedBindings = async (
  client: InstanceScopedClient,
  input: DataProviderObservation,
  isConflict: boolean
): Promise<void> => {
  if (isConflict) {
    await client.query(
      `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'conflict', last_observed_at = NOW()
WHERE instance_id = $1
  AND status IN ('verified', 'conflict')
  AND (
    (principal_type = $2 AND principal_id = $3::uuid AND credential_fingerprint = $4)
    OR data_provider_id = $5
  );
`,
      [
        input.instanceId,
        input.principalType,
        input.principalId,
        input.credentialFingerprint,
        input.dataProviderId,
      ]
    );
    return;
  }

  await client.query(
    `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'historical', superseded_at = NOW(), last_observed_at = NOW()
WHERE instance_id = $1
  AND principal_type = $2
  AND principal_id = $3::uuid
  AND credential_fingerprint <> $4
  AND status = 'verified';
`,
    [input.instanceId, input.principalType, input.principalId, input.credentialFingerprint]
  );
};

const upsertObservation = async (
  client: InstanceScopedClient,
  input: DataProviderObservation,
  isConflict: boolean
): Promise<BindingRow> => {
  const result = await client.query<BindingRow>(
    `
INSERT INTO iam.mainserver_data_provider_bindings (
  instance_id,
  principal_type,
  principal_id,
  credential_fingerprint,
  data_provider_id,
  data_provider_name,
  status,
  evidence_kind
)
VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8)
ON CONFLICT ON CONSTRAINT mainserver_data_provider_bindings_observation_key
DO UPDATE SET
  data_provider_name = COALESCE(EXCLUDED.data_provider_name, iam.mainserver_data_provider_bindings.data_provider_name),
  status = EXCLUDED.status,
  evidence_kind = EXCLUDED.evidence_kind,
  last_observed_at = NOW(),
  superseded_at = NULL
RETURNING ${bindingColumns};
`,
    [
      input.instanceId,
      input.principalType,
      input.principalId,
      input.credentialFingerprint,
      input.dataProviderId,
      input.dataProviderName ?? null,
      isConflict ? 'conflict' : 'verified',
      input.evidenceKind,
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('mainserver_data_provider_binding_write_failed');
  }
  return row;
};

export const recordMainserverDataProviderObservation = async (input: {
  readonly instanceId: string;
  readonly principalType: MainserverPrincipalType;
  readonly principalId: string;
  readonly credentialFingerprint: string;
  readonly dataProviderId: string;
  readonly dataProviderName?: string;
  readonly evidenceKind: MainserverDataProviderEvidenceKind;
}): Promise<RecordMainserverDataProviderObservationResult> => {
  const observation = normalizeObservation(input);

  return withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      observation.instanceId,
      `mainserver-data-provider:${observation.dataProviderId}`,
    ]);

    const relatedResult = await client.query<BindingRow>(
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
        observation.instanceId,
        observation.principalType,
        observation.principalId,
        observation.credentialFingerprint,
        observation.dataProviderId,
      ]
    );

    const exactBinding = relatedResult.rows.find((row) => isExactObservation(row, observation));
    const isConflict =
      observationConflicts(relatedResult.rows, observation) || exactBinding?.status === 'conflict';
    await updateRelatedBindings(client, observation, isConflict);
    const row = await upsertObservation(client, observation, isConflict);

    return {
      binding: mapBinding(row),
      outcome: isConflict ? 'conflict' : exactBinding ? 'confirmed' : 'created',
    };
  });
};

const isCurrentActiveUser = (account: AccountLifecycleRow | undefined): boolean =>
  account?.deletion_lifecycle_state === 'active' &&
  account.is_blocked === false &&
  account.soft_deleted_at === null &&
  account.permanently_deleted_at === null;

const isPermanentlyDeletedUser = (account: AccountLifecycleRow | undefined): boolean =>
  account === undefined ||
  account.deletion_lifecycle_state === 'deleted' ||
  account.permanently_deleted_at !== null;

export const reconcileDeletedUserDataProviderConflict = async (input: {
  readonly instanceId: string;
  readonly principalType: MainserverPrincipalType;
  readonly principalId: string;
  readonly credentialFingerprint: string;
  readonly dataProviderId: string;
}): Promise<ReconcileDeletedUserDataProviderConflictResult> => {
  const observation = normalizeObservation({
    ...input,
    evidenceKind: 'identity_endpoint',
  });
  if (observation.principalType !== 'user') {
    return { outcome: 'not_resolved', reason: 'unsupported_current_principal' };
  }

  return withInstanceScopedDb(observation.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      observation.instanceId,
      `mainserver-data-provider:${observation.dataProviderId}`,
    ]);

    const relatedResult = await client.query<BindingRow>(
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
        observation.instanceId,
        observation.principalType,
        observation.principalId,
        observation.credentialFingerprint,
        observation.dataProviderId,
      ]
    );
    const exactBinding = relatedResult.rows.find((row) => isExactObservation(row, observation));
    if (!exactBinding) {
      return { outcome: 'not_resolved', reason: 'exact_binding_missing' };
    }

    const userPrincipalIds = [
      ...new Set(
        relatedResult.rows
          .filter((row) => row.principal_type === 'user')
          .map((row) => row.principal_id)
      ),
    ];
    const accountsResult = await client.query<AccountLifecycleRow>(
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
      [observation.instanceId, userPrincipalIds]
    );
    const accountsById = new Map(accountsResult.rows.map((account) => [account.id, account]));
    if (!isCurrentActiveUser(accountsById.get(observation.principalId))) {
      return { outcome: 'not_resolved', reason: 'current_user_not_active' };
    }

    const hasCurrentCredentialProviderMismatch = relatedResult.rows.some(
      (row) =>
        row.principal_type === observation.principalType &&
        row.principal_id === observation.principalId &&
        row.credential_fingerprint === observation.credentialFingerprint &&
        row.data_provider_id !== observation.dataProviderId
    );
    if (hasCurrentCredentialProviderMismatch) {
      return { outcome: 'not_resolved', reason: 'current_credential_provider_mismatch' };
    }

    const competingBindings = relatedResult.rows.filter(
      (row) =>
        row.data_provider_id === observation.dataProviderId &&
        (row.principal_type !== observation.principalType ||
          row.principal_id !== observation.principalId)
    );
    if (competingBindings.length === 0) {
      return exactBinding.status === 'verified'
        ? {
            outcome: 'resolved',
            binding: mapBinding(exactBinding),
            historicalBindingCount: 0,
          }
        : { outcome: 'not_resolved', reason: 'no_permanently_deleted_competitor' };
    }
    if (competingBindings.some((row) => row.principal_type !== 'user')) {
      return { outcome: 'not_resolved', reason: 'competing_principal_not_user' };
    }
    if (
      competingBindings.some((row) => !isPermanentlyDeletedUser(accountsById.get(row.principal_id)))
    ) {
      return { outcome: 'not_resolved', reason: 'competing_user_not_permanently_deleted' };
    }

    const historicalBindingIds = [...new Set(competingBindings.map((row) => row.id))];
    await client.query(
      `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'historical', superseded_at = NOW(), last_observed_at = NOW()
WHERE instance_id = $1
  AND id = ANY($2::uuid[])
  AND status IN ('verified', 'conflict');
`,
      [observation.instanceId, historicalBindingIds]
    );
    const verifiedResult = await client.query<BindingRow>(
      `
UPDATE iam.mainserver_data_provider_bindings
SET status = 'verified', superseded_at = NULL, last_observed_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
  AND status IN ('verified', 'conflict')
RETURNING ${bindingColumns};
`,
      [observation.instanceId, exactBinding.id]
    );
    const verifiedBinding = verifiedResult.rows[0];
    if (!verifiedBinding) {
      throw new Error('mainserver_data_provider_binding_reconciliation_write_failed');
    }
    return {
      outcome: 'resolved',
      binding: mapBinding(verifiedBinding),
      historicalBindingCount: historicalBindingIds.length,
    };
  });
};

export const loadCurrentMainserverDataProviderBinding = async (input: {
  readonly instanceId: string;
  readonly principalType: MainserverPrincipalType;
  readonly principalId: string;
  readonly credentialFingerprint: string;
}): Promise<MainserverDataProviderBinding | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<BindingRow>(
      `
SELECT ${bindingColumns}
FROM iam.mainserver_data_provider_bindings binding
WHERE binding.instance_id = $1
  AND binding.principal_type = $2
  AND binding.principal_id = $3::uuid
  AND binding.credential_fingerprint = $4
  AND binding.status = 'verified'
  AND (
    (
      $2 = 'user'
      AND EXISTS (
        SELECT 1
        FROM iam.accounts account
        WHERE account.instance_id = binding.instance_id
          AND account.id = binding.principal_id
          AND account.deletion_lifecycle_state = 'active'
          AND account.is_blocked = FALSE
          AND account.soft_deleted_at IS NULL
          AND account.permanently_deleted_at IS NULL
      )
    )
    OR (
      $2 = 'organization'
      AND EXISTS (
        SELECT 1
        FROM iam.organizations organization
        WHERE organization.instance_id = binding.instance_id
          AND organization.id = binding.principal_id
          AND organization.is_active = TRUE
      )
    )
  )
ORDER BY binding.last_observed_at DESC
LIMIT 2;
`,
      [input.instanceId, input.principalType, input.principalId, input.credentialFingerprint]
    );
    return result.rows.length === 1 && result.rows[0] ? mapBinding(result.rows[0]) : undefined;
  });

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import type {
  MainserverDataProviderBindingStatus,
  MainserverDataProviderEvidenceKind,
  MainserverPrincipalType,
} from './mainserver-data-provider-bindings.js';
import type {
  MainserverMutationProviderOutcome,
  MainserverMutationReconciliationStatus,
} from './mainserver-mutation-journal.js';

type CountRow = Readonly<{ key: string; count: string }>;
type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

type BindingDiagnosticRow = Readonly<{
  principal_type: MainserverPrincipalType;
  principal_id: string;
  credential_fingerprint_prefix: string;
  data_provider_id: string;
  status: MainserverDataProviderBindingStatus;
  evidence_kind: MainserverDataProviderEvidenceKind;
  last_observed_at: string;
}>;

type MutationDiagnosticRow = Readonly<{
  operation_external_id: string;
  action_id: string;
  content_type: string;
  content_id: string | null;
  acting_principal_type: MainserverPrincipalType;
  credential_fingerprint_prefix: string;
  authorization_mode: 'credential_visible_compatibility' | 'exact';
  resolver_mode: 'automatic' | 'compatibility' | 'shadow';
  candidate_authorization_mode: 'credential_visible_compatibility' | 'exact' | null;
  candidate_allowed: boolean | null;
  shadow_difference: boolean;
  provider_outcome: MainserverMutationProviderOutcome;
  reconciliation_status: MainserverMutationReconciliationStatus;
  attempt_count: number;
  last_error_code: string | null;
  updated_at: string;
}>;

const countRecord = (rows: readonly CountRow[]): Readonly<Record<string, number>> =>
  Object.fromEntries(rows.map((row) => [row.key, Number.parseInt(row.count, 10) || 0]));

const loadBindingDiagnosticRows = async (client: InstanceScopedClient, instanceId: string) => {
  const [statuses, principalTypes, rotations, recent] = await Promise.all([
    client.query<CountRow>(
      `SELECT status AS key, COUNT(*)::text AS count
         FROM iam.mainserver_data_provider_bindings
         WHERE instance_id = $1 GROUP BY status;`,
      [instanceId]
    ),
    client.query<CountRow>(
      `SELECT principal_type AS key, COUNT(*)::text AS count
         FROM iam.mainserver_data_provider_bindings
         WHERE instance_id = $1 GROUP BY principal_type;`,
      [instanceId]
    ),
    client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (
           SELECT principal_type, principal_id
           FROM iam.mainserver_data_provider_bindings
           WHERE instance_id = $1
           GROUP BY principal_type, principal_id
           HAVING COUNT(DISTINCT credential_fingerprint) > 1
         ) rotations;`,
      [instanceId]
    ),
    client.query<BindingDiagnosticRow>(
      `SELECT principal_type, principal_id::text,
                LEFT(credential_fingerprint, 12) AS credential_fingerprint_prefix,
                data_provider_id, status, evidence_kind, last_observed_at::text
         FROM iam.mainserver_data_provider_bindings
         WHERE instance_id = $1
         ORDER BY last_observed_at DESC LIMIT 50;`,
      [instanceId]
    ),
  ]);
  return { principalTypes, recent, rotations, statuses };
};

const loadMutationDiagnosticRows = async (client: InstanceScopedClient, instanceId: string) => {
  const [modes, resolverModes, reconciliation, modeSwitches, shadowDifferences, recent] =
    await Promise.all([
      client.query<CountRow>(
        `SELECT authorization_mode AS key, COUNT(*)::text AS count
           FROM iam.mainserver_mutation_journal
           WHERE instance_id = $1 GROUP BY authorization_mode;`,
        [instanceId]
      ),
      client.query<CountRow>(
        `SELECT resolver_mode AS key, COUNT(*)::text AS count
           FROM iam.mainserver_mutation_journal
           WHERE instance_id = $1 GROUP BY resolver_mode;`,
        [instanceId]
      ),
      client.query<CountRow>(
        `SELECT reconciliation_status AS key, COUNT(*)::text AS count
           FROM iam.mainserver_mutation_journal
           WHERE instance_id = $1 GROUP BY reconciliation_status;`,
        [instanceId]
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM (
             SELECT authorization_mode,
                    LAG(authorization_mode) OVER (
                      PARTITION BY acting_principal_type, acting_principal_id, action_id
                      ORDER BY created_at, id
                    ) AS previous_mode
             FROM iam.mainserver_mutation_journal
             WHERE instance_id = $1
           ) transitions
           WHERE previous_mode IS NOT NULL AND previous_mode <> authorization_mode;`,
        [instanceId]
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM iam.mainserver_mutation_journal
           WHERE instance_id = $1 AND shadow_difference = TRUE;`,
        [instanceId]
      ),
      client.query<MutationDiagnosticRow>(
        `SELECT operation_external_id, action_id, content_type, content_id,
                acting_principal_type,
                LEFT(credential_fingerprint, 12) AS credential_fingerprint_prefix,
                authorization_mode, resolver_mode, candidate_authorization_mode,
                candidate_allowed, shadow_difference, provider_outcome, reconciliation_status,
                attempt_count, last_error_code, updated_at::text
         FROM iam.mainserver_mutation_journal
         WHERE instance_id = $1
         ORDER BY updated_at DESC LIMIT 50;`,
        [instanceId]
      ),
    ]);
  return { modes, modeSwitches, recent, reconciliation, resolverModes, shadowDifferences };
};

const mapRecentBinding = (row: BindingDiagnosticRow) => ({
  principalType: row.principal_type,
  principalId: row.principal_id,
  credentialFingerprintPrefix: row.credential_fingerprint_prefix,
  dataProviderId: row.data_provider_id,
  status: row.status,
  evidenceKind: row.evidence_kind,
  lastObservedAt: row.last_observed_at,
});

const mapRecentMutation = (row: MutationDiagnosticRow) => ({
  operationExternalId: row.operation_external_id,
  actionId: row.action_id,
  contentType: row.content_type,
  ...(row.content_id ? { contentId: row.content_id } : {}),
  actingPrincipalType: row.acting_principal_type,
  credentialFingerprintPrefix: row.credential_fingerprint_prefix,
  authorizationMode: row.authorization_mode,
  resolverMode: row.resolver_mode,
  ...(row.candidate_authorization_mode
    ? { candidateAuthorizationMode: row.candidate_authorization_mode }
    : {}),
  ...(typeof row.candidate_allowed === 'boolean'
    ? { candidateAllowed: row.candidate_allowed }
    : {}),
  shadowDifference: row.shadow_difference,
  providerOutcome: row.provider_outcome,
  reconciliationStatus: row.reconciliation_status,
  attemptCount: row.attempt_count,
  ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
  updatedAt: row.updated_at,
});

export type MainserverAuthoringDiagnostics = Readonly<{
  bindings: Readonly<{
    byStatus: Readonly<Record<string, number>>;
    byPrincipalType: Readonly<Record<string, number>>;
    rotationPrincipalCount: number;
    recent: readonly Readonly<{
      principalType: MainserverPrincipalType;
      principalId: string;
      credentialFingerprintPrefix: string;
      dataProviderId: string;
      status: MainserverDataProviderBindingStatus;
      evidenceKind: MainserverDataProviderEvidenceKind;
      lastObservedAt: string;
    }>[];
  }>;
  mutations: Readonly<{
    byAuthorizationMode: Readonly<Record<string, number>>;
    byResolverMode: Readonly<Record<string, number>>;
    byReconciliationStatus: Readonly<Record<string, number>>;
    automaticModeSwitchCount: number;
    shadowDifferenceCount: number;
    recent: readonly Readonly<{
      operationExternalId: string;
      actionId: string;
      contentType: string;
      contentId?: string;
      actingPrincipalType: MainserverPrincipalType;
      credentialFingerprintPrefix: string;
      authorizationMode: 'credential_visible_compatibility' | 'exact';
      resolverMode: 'automatic' | 'compatibility' | 'shadow';
      candidateAuthorizationMode?: 'credential_visible_compatibility' | 'exact';
      candidateAllowed?: boolean;
      shadowDifference: boolean;
      providerOutcome: MainserverMutationProviderOutcome;
      reconciliationStatus: MainserverMutationReconciliationStatus;
      attemptCount: number;
      lastErrorCode?: string;
      updatedAt: string;
    }>[];
  }>;
}>;

export const loadMainserverAuthoringDiagnostics = async (
  instanceId: string
): Promise<MainserverAuthoringDiagnostics> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const [bindings, mutations] = await Promise.all([
      loadBindingDiagnosticRows(client, instanceId),
      loadMutationDiagnosticRows(client, instanceId),
    ]);

    return {
      bindings: {
        byStatus: countRecord(bindings.statuses.rows),
        byPrincipalType: countRecord(bindings.principalTypes.rows),
        rotationPrincipalCount: Number.parseInt(bindings.rotations.rows[0]?.count ?? '0', 10) || 0,
        recent: bindings.recent.rows.map(mapRecentBinding),
      },
      mutations: {
        byAuthorizationMode: countRecord(mutations.modes.rows),
        byResolverMode: countRecord(mutations.resolverModes.rows),
        byReconciliationStatus: countRecord(mutations.reconciliation.rows),
        automaticModeSwitchCount:
          Number.parseInt(mutations.modeSwitches.rows[0]?.count ?? '0', 10) || 0,
        shadowDifferenceCount:
          Number.parseInt(mutations.shadowDifferences.rows[0]?.count ?? '0', 10) || 0,
        recent: mutations.recent.rows.map(mapRecentMutation),
      },
    };
  });

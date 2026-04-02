import type { QueryClient } from '../shared/db-helpers.js';

export type SchemaGuardCheckKind = 'column' | 'index' | 'policy' | 'table';

export type SchemaGuardCheck = {
  readonly expectedMigration?: string;
  readonly kind: SchemaGuardCheckKind;
  readonly message: string;
  readonly ok: boolean;
  readonly reasonCode: 'missing_column' | 'missing_index' | 'missing_policy' | 'missing_table' | 'policy_mismatch';
  readonly schemaObject: string;
};

export type SchemaGuardReport = {
  readonly checks: readonly SchemaGuardCheck[];
  readonly ok: boolean;
};

type SchemaGuardRow = {
  account_groups_exists: boolean;
  account_groups_origin_column_exists: boolean;
  activity_logs_exists: boolean;
  accounts_avatar_url_column_exists: boolean;
  accounts_instance_id_column_exists: boolean;
  accounts_isolation_policy_matches: boolean;
  accounts_notes_column_exists: boolean;
  accounts_preferred_language_column_exists: boolean;
  accounts_timezone_column_exists: boolean;
  accounts_username_ciphertext_column_exists: boolean;
  group_roles_exists: boolean;
  groups_exists: boolean;
  idx_accounts_kc_subject_instance_exists: boolean;
  instance_memberships_isolation_policy_matches: boolean;
};

const REQUIRED_SCHEMA_CHECKS = [
  {
    field: 'groups_exists',
    kind: 'table',
    schemaObject: 'iam.groups',
    reasonCode: 'missing_table',
    expectedMigration: '0014_iam_groups.sql',
    message: 'Kritische IAM-Tabelle iam.groups fehlt.',
  },
  {
    field: 'group_roles_exists',
    kind: 'table',
    schemaObject: 'iam.group_roles',
    reasonCode: 'missing_table',
    expectedMigration: '0014_iam_groups.sql',
    message: 'Kritische IAM-Tabelle iam.group_roles fehlt.',
  },
  {
    field: 'account_groups_exists',
    kind: 'table',
    schemaObject: 'iam.account_groups',
    reasonCode: 'missing_table',
    expectedMigration: '0014_iam_groups.sql',
    message: 'Kritische IAM-Tabelle iam.account_groups fehlt.',
  },
  {
    field: 'accounts_instance_id_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.instance_id',
    reasonCode: 'missing_column',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritische IAM-Spalte iam.accounts.instance_id fehlt.',
  },
  {
    field: 'accounts_username_ciphertext_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.username_ciphertext',
    reasonCode: 'missing_column',
    expectedMigration: '0011_iam_account_username.sql',
    message: 'Kritische IAM-Spalte iam.accounts.username_ciphertext fehlt.',
  },
  {
    field: 'accounts_avatar_url_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.avatar_url',
    reasonCode: 'missing_column',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritische IAM-Spalte iam.accounts.avatar_url fehlt.',
  },
  {
    field: 'accounts_preferred_language_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.preferred_language',
    reasonCode: 'missing_column',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritische IAM-Spalte iam.accounts.preferred_language fehlt.',
  },
  {
    field: 'accounts_timezone_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.timezone',
    reasonCode: 'missing_column',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritische IAM-Spalte iam.accounts.timezone fehlt.',
  },
  {
    field: 'accounts_notes_column_exists',
    kind: 'column',
    schemaObject: 'iam.accounts.notes',
    reasonCode: 'missing_column',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritische IAM-Spalte iam.accounts.notes fehlt.',
  },
  {
    field: 'activity_logs_exists',
    kind: 'table',
    schemaObject: 'iam.activity_logs',
    reasonCode: 'missing_table',
    expectedMigration: '0001_iam_core.sql',
    message: 'Kritische IAM-Tabelle iam.activity_logs fehlt.',
  },
  {
    field: 'account_groups_origin_column_exists',
    kind: 'column',
    schemaObject: 'iam.account_groups.origin',
    reasonCode: 'missing_column',
    expectedMigration: '0019_iam_account_groups_origin_compat.sql',
    message: 'Kritische IAM-Spalte iam.account_groups.origin fehlt.',
  },
  {
    field: 'idx_accounts_kc_subject_instance_exists',
    kind: 'index',
    schemaObject: 'idx_accounts_kc_subject_instance',
    reasonCode: 'missing_index',
    expectedMigration: '0004_iam_account_profile.sql',
    message: 'Kritischer IAM-Index idx_accounts_kc_subject_instance fehlt.',
  },
  {
    field: 'accounts_isolation_policy_matches',
    kind: 'policy',
    schemaObject: 'policy:accounts_isolation_policy',
    reasonCode: 'policy_mismatch',
    expectedMigration: '0018_iam_accounts_instance_policy.sql',
    message: 'accounts_isolation_policy ist nicht im Sollzustand.',
  },
  {
    field: 'instance_memberships_isolation_policy_matches',
    kind: 'policy',
    schemaObject: 'policy:instance_memberships_isolation_policy',
    reasonCode: 'policy_mismatch',
    expectedMigration: '0001_iam_core.sql',
    message: 'instance_memberships_isolation_policy ist nicht im Sollzustand.',
  },
] as const satisfies ReadonlyArray<{
  expectedMigration: string;
  field: keyof SchemaGuardRow;
  kind: SchemaGuardCheckKind;
  message: string;
  reasonCode: SchemaGuardCheck['reasonCode'];
  schemaObject: string;
}>;

export const CRITICAL_IAM_SCHEMA_GUARD_SQL = `
SELECT
  to_regclass('iam.groups') IS NOT NULL AS groups_exists,
  to_regclass('iam.group_roles') IS NOT NULL AS group_roles_exists,
  to_regclass('iam.account_groups') IS NOT NULL AS account_groups_exists,
  to_regclass('iam.activity_logs') IS NOT NULL AS activity_logs_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'instance_id'
  ) AS accounts_instance_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'username_ciphertext'
  ) AS accounts_username_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'avatar_url'
  ) AS accounts_avatar_url_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'preferred_language'
  ) AS accounts_preferred_language_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'timezone'
  ) AS accounts_timezone_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'accounts'
      AND column_name = 'notes'
  ) AS accounts_notes_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'origin'
  ) AS account_groups_origin_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'iam'
      AND tablename = 'accounts'
      AND indexname = 'idx_accounts_kc_subject_instance'
  ) AS idx_accounts_kc_subject_instance_exists,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'iam'
      AND tablename = 'accounts'
      AND policyname = 'accounts_isolation_policy'
      AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
      AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
  ) AS accounts_isolation_policy_matches,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'iam'
      AND tablename = 'instance_memberships'
      AND policyname = 'instance_memberships_isolation_policy'
      AND COALESCE(qual, '') LIKE '%instance_id = iam.current_instance_id()%'
      AND COALESCE(with_check, '') LIKE '%instance_id = iam.current_instance_id()%'
  ) AS instance_memberships_isolation_policy_matches;
`;

const toBoolean = (value: unknown) => value === true || value === 't' || value === 'true' || value === 1;

export const evaluateCriticalIamSchemaGuard = (row: Record<string, unknown>): SchemaGuardReport => {
  const checks = REQUIRED_SCHEMA_CHECKS.map((definition) => ({
    kind: definition.kind,
    schemaObject: definition.schemaObject,
    reasonCode: definition.reasonCode,
    expectedMigration: definition.expectedMigration,
    message: definition.message,
    ok: toBoolean(row[definition.field]),
  }));

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
};

export const runCriticalIamSchemaGuard = async (client: QueryClient): Promise<SchemaGuardReport> => {
  const result = await client.query<SchemaGuardRow>(CRITICAL_IAM_SCHEMA_GUARD_SQL);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return evaluateCriticalIamSchemaGuard(row ?? {});
};

export const summarizeSchemaGuardFailures = (report: SchemaGuardReport): string | undefined => {
  const failed = report.checks.filter((check) => !check.ok);
  if (failed.length === 0) {
    return undefined;
  }

  return failed
    .map((check) => `${check.reasonCode}:${check.schemaObject}`)
    .join(', ');
};

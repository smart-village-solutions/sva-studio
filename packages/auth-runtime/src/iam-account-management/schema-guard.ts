import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, type ClientConfig } from 'pg';

import type { QueryClient } from '../db.js';

export type SchemaGuardCheckKind = 'column' | 'index' | 'policy' | 'table';

export type SchemaGuardCheck = {
  readonly expectedMigration?: string;
  readonly kind: SchemaGuardCheckKind;
  readonly message: string;
  readonly ok: boolean;
  readonly reasonCode:
    'missing_column' | 'missing_index' | 'missing_policy' | 'missing_table' | 'policy_mismatch';
  readonly schemaObject: string;
};

export type SchemaGuardReport = {
  readonly checks: readonly SchemaGuardCheck[];
  readonly ok: boolean;
};

export type ExpectedGooseMigration = {
  readonly fileName: string;
  readonly version: number;
};

export type MigrationReadinessReport = {
  readonly appliedVersion: number | null;
  readonly expectedMigration: string;
  readonly expectedVersion: number;
  readonly ok: boolean;
  readonly reasonCode?: 'migration_drift';
};

export type IamDatabaseReadinessReport = {
  readonly migration: MigrationReadinessReport;
  readonly ok: boolean;
  readonly schema: SchemaGuardReport;
};

export type GraphileWorkerReadinessReport = {
  readonly failedChecks: readonly string[];
  readonly ok: boolean;
};

const GRAPHILE_WORKER_READINESS_SQL = `
WITH worker_principal AS (
  SELECT to_regrole($2) AS role_oid
)
SELECT
  to_regnamespace('graphile_worker') IS NOT NULL AS graphile_schema_exists,
  worker_principal.role_oid IS NOT NULL AS worker_role_exists,
  COALESCE(has_function_privilege(
    $1,
    to_regprocedure('graphile_worker.sva_enqueue_job(text,json,text,integer,text,timestamp with time zone)'),
    'EXECUTE'
  ), false) AS app_can_enqueue,
  NOT has_database_privilege($1, current_database(), 'CREATE')
    AND NOT has_schema_privilege($1, 'public', 'CREATE') AS app_cannot_create,
  COALESCE(has_table_privilege(
    worker_principal.role_oid,
    to_regclass('graphile_worker._private_jobs'),
    'SELECT,INSERT,UPDATE,DELETE'
  ), false)
    AND COALESCE(
      has_schema_privilege(worker_principal.role_oid, 'graphile_worker', 'USAGE'),
      false
    ) AS worker_can_process,
  worker_principal.role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphile_worker'
      AND NOT has_function_privilege(worker_principal.role_oid, p.oid, 'EXECUTE')
  ) AS worker_functions_complete,
  worker_principal.role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_sequences sequence
    WHERE sequence.schemaname = 'graphile_worker'
      AND NOT has_sequence_privilege(
        worker_principal.role_oid,
        format('%I.%I', sequence.schemaname, sequence.sequencename),
        'USAGE,SELECT,UPDATE'
      )
  ) AS worker_sequences_complete,
  worker_principal.role_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'graphile_worker'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies policy
        WHERE policy.schemaname = 'graphile_worker'
          AND policy.tablename = c.relname
          AND policy.policyname = 'sva_job_worker_access'
          AND $2 = ANY(policy.roles)
          AND COALESCE(policy.qual, '') IN ('true', '(true)')
          AND COALESCE(policy.with_check, '') IN ('true', '(true)')
      )
  ) AS worker_policies_complete
FROM worker_principal;
`;

const GRAPHILE_WORKER_READINESS_FIELDS = [
  'graphile_schema_exists',
  'worker_role_exists',
  'app_can_enqueue',
  'app_cannot_create',
  'worker_can_process',
  'worker_functions_complete',
  'worker_sequences_complete',
  'worker_policies_complete',
] as const;

type SchemaGuardRow = {
  account_groups_exists: boolean;
  account_groups_origin_column_exists: boolean;
  activity_logs_exists: boolean;
  platform_activity_logs_exists: boolean;
  accounts_avatar_url_column_exists: boolean;
  accounts_instance_id_column_exists: boolean;
  accounts_isolation_policy_matches: boolean;
  accounts_notes_column_exists: boolean;
  accounts_preferred_language_column_exists: boolean;
  accounts_timezone_column_exists: boolean;
  accounts_username_ciphertext_column_exists: boolean;
  group_roles_exists: boolean;
  groups_exists: boolean;
  instance_hostnames_exists: boolean;
  instance_hostnames_rls_disabled: boolean;
  instance_waste_data_sources_exists: boolean;
  instances_auth_client_id_column_exists: boolean;
  instances_auth_client_secret_ciphertext_column_exists: boolean;
  instances_auth_issuer_url_column_exists: boolean;
  instances_auth_realm_column_exists: boolean;
  instances_rls_disabled: boolean;
  instances_primary_hostname_column_exists: boolean;
  instances_tenant_admin_client_id_column_exists: boolean;
  instances_tenant_admin_client_secret_ciphertext_column_exists: boolean;
  instances_tenant_admin_email_column_exists: boolean;
  instances_tenant_admin_first_name_column_exists: boolean;
  instances_tenant_admin_last_name_column_exists: boolean;
  instances_tenant_admin_username_column_exists: boolean;
  idx_accounts_kc_subject_instance_exists: boolean;
  instance_memberships_isolation_policy_matches: boolean;
};

export const CRITICAL_IAM_SCHEMA_GUARD_FIELDS = [
  'groups_exists',
  'group_roles_exists',
  'account_groups_exists',
  'activity_logs_exists',
  'platform_activity_logs_exists',
  'accounts_instance_id_column_exists',
  'accounts_username_ciphertext_column_exists',
  'accounts_avatar_url_column_exists',
  'accounts_preferred_language_column_exists',
  'accounts_timezone_column_exists',
  'accounts_notes_column_exists',
  'account_groups_origin_column_exists',
  'instance_hostnames_exists',
  'instance_hostnames_rls_disabled',
  'instance_waste_data_sources_exists',
  'instances_primary_hostname_column_exists',
  'instances_rls_disabled',
  'instances_auth_realm_column_exists',
  'instances_auth_client_id_column_exists',
  'instances_auth_issuer_url_column_exists',
  'instances_auth_client_secret_ciphertext_column_exists',
  'instances_tenant_admin_client_id_column_exists',
  'instances_tenant_admin_client_secret_ciphertext_column_exists',
  'instances_tenant_admin_username_column_exists',
  'instances_tenant_admin_email_column_exists',
  'instances_tenant_admin_first_name_column_exists',
  'instances_tenant_admin_last_name_column_exists',
  'idx_accounts_kc_subject_instance_exists',
  'accounts_isolation_policy_matches',
  'instance_memberships_isolation_policy_matches',
] as const satisfies ReadonlyArray<keyof SchemaGuardRow>;

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
    field: 'platform_activity_logs_exists',
    kind: 'table',
    schemaObject: 'iam.platform_activity_logs',
    reasonCode: 'missing_table',
    expectedMigration: '0028_iam_platform_activity_logs.sql',
    message: 'Kritische IAM-Tabelle iam.platform_activity_logs fehlt.',
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
    field: 'instance_hostnames_exists',
    kind: 'table',
    schemaObject: 'iam.instance_hostnames',
    reasonCode: 'missing_table',
    expectedMigration: '0025_iam_instance_registry_provisioning.sql',
    message: 'Kritische IAM-Tabelle iam.instance_hostnames fehlt.',
  },
  {
    field: 'instance_hostnames_rls_disabled',
    kind: 'policy',
    schemaObject: 'policy:instance_hostnames_rls_disabled',
    reasonCode: 'policy_mismatch',
    expectedMigration: '0023_iam_disable_rls.sql',
    message: 'iam.instance_hostnames darf fuer den Runtime-Lookup keine aktive RLS erzwingen.',
  },
  {
    field: 'instance_waste_data_sources_exists',
    kind: 'table',
    schemaObject: 'iam.instance_waste_data_sources',
    reasonCode: 'missing_table',
    expectedMigration: '0065_iam_instance_waste_data_sources.sql',
    message: 'Kritische IAM-Tabelle iam.instance_waste_data_sources fehlt.',
  },
  {
    field: 'instances_primary_hostname_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.primary_hostname',
    reasonCode: 'missing_column',
    expectedMigration: '0025_iam_instance_registry_provisioning.sql',
    message: 'Kritische IAM-Spalte iam.instances.primary_hostname fehlt.',
  },
  {
    field: 'instances_rls_disabled',
    kind: 'policy',
    schemaObject: 'policy:instances_rls_disabled',
    reasonCode: 'policy_mismatch',
    expectedMigration: '0023_iam_disable_rls.sql',
    message: 'iam.instances darf fuer den Runtime-Lookup keine aktive RLS erzwingen.',
  },
  {
    field: 'instances_auth_realm_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.auth_realm',
    reasonCode: 'missing_column',
    expectedMigration: '0026_iam_instance_auth_config.sql',
    message: 'Kritische IAM-Spalte iam.instances.auth_realm fehlt.',
  },
  {
    field: 'instances_auth_client_id_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.auth_client_id',
    reasonCode: 'missing_column',
    expectedMigration: '0026_iam_instance_auth_config.sql',
    message: 'Kritische IAM-Spalte iam.instances.auth_client_id fehlt.',
  },
  {
    field: 'instances_auth_issuer_url_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.auth_issuer_url',
    reasonCode: 'missing_column',
    expectedMigration: '0026_iam_instance_auth_config.sql',
    message: 'Kritische IAM-Spalte iam.instances.auth_issuer_url fehlt.',
  },
  {
    field: 'instances_auth_client_secret_ciphertext_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.auth_client_secret_ciphertext',
    reasonCode: 'missing_column',
    expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
    message: 'Kritische IAM-Spalte iam.instances.auth_client_secret_ciphertext fehlt.',
  },
  {
    field: 'instances_tenant_admin_client_id_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_client_id',
    reasonCode: 'missing_column',
    expectedMigration: '0030_iam_tenant_admin_client_contract.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_client_id fehlt.',
  },
  {
    field: 'instances_tenant_admin_client_secret_ciphertext_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_client_secret_ciphertext',
    reasonCode: 'missing_column',
    expectedMigration: '0030_iam_tenant_admin_client_contract.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_client_secret_ciphertext fehlt.',
  },
  {
    field: 'instances_tenant_admin_username_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_username',
    reasonCode: 'missing_column',
    expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_username fehlt.',
  },
  {
    field: 'instances_tenant_admin_email_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_email',
    reasonCode: 'missing_column',
    expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_email fehlt.',
  },
  {
    field: 'instances_tenant_admin_first_name_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_first_name',
    reasonCode: 'missing_column',
    expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_first_name fehlt.',
  },
  {
    field: 'instances_tenant_admin_last_name_column_exists',
    kind: 'column',
    schemaObject: 'iam.instances.tenant_admin_last_name',
    reasonCode: 'missing_column',
    expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
    message: 'Kritische IAM-Spalte iam.instances.tenant_admin_last_name fehlt.',
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
  to_regclass('iam.platform_activity_logs') IS NOT NULL AS platform_activity_logs_exists,
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
  to_regclass('iam.instance_hostnames') IS NOT NULL AS instance_hostnames_exists,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'iam'
      AND c.relname = 'instance_hostnames'
      AND c.relrowsecurity = false
      AND c.relforcerowsecurity = false
  ) AS instance_hostnames_rls_disabled,
  to_regclass('iam.instance_waste_data_sources') IS NOT NULL AS instance_waste_data_sources_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'primary_hostname'
  ) AS instances_primary_hostname_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'iam'
      AND c.relname = 'instances'
      AND c.relrowsecurity = false
      AND c.relforcerowsecurity = false
  ) AS instances_rls_disabled,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_realm'
  ) AS instances_auth_realm_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_client_id'
  ) AS instances_auth_client_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_issuer_url'
  ) AS instances_auth_issuer_url_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'auth_client_secret_ciphertext'
  ) AS instances_auth_client_secret_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_client_id'
  ) AS instances_tenant_admin_client_id_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_client_secret_ciphertext'
  ) AS instances_tenant_admin_client_secret_ciphertext_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_username'
  ) AS instances_tenant_admin_username_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_email'
  ) AS instances_tenant_admin_email_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_first_name'
  ) AS instances_tenant_admin_first_name_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'tenant_admin_last_name'
  ) AS instances_tenant_admin_last_name_column_exists,
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

const GOOSE_MIGRATION_FILE_PATTERN = /^(\d+)_.*\.sql$/u;
const DEFAULT_MIGRATIONS_DIRECTORY = 'packages/data/migrations';
const expectedMigrationByDirectory = new Map<string, ExpectedGooseMigration>();

export const resolveExpectedGooseMigration = (
  fileNames: readonly string[]
): ExpectedGooseMigration => {
  const migrations = fileNames
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => {
      const match = GOOSE_MIGRATION_FILE_PATTERN.exec(fileName);
      const version = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
      if (!Number.isInteger(version)) {
        throw new Error(`Migration ${fileName} hat keinen gueltigen numerischen Versionspraefix.`);
      }
      return { fileName, version };
    })
    .sort(
      (left, right) => left.version - right.version || left.fileName.localeCompare(right.fileName)
    );

  const expected = migrations[migrations.length - 1];
  if (!expected) {
    throw new Error('Keine Goose-Migrationen fuer den Runtime-Sollstand gefunden.');
  }
  const duplicateVersion = migrations.find(
    (migration, index) => index > 0 && migrations[index - 1]?.version === migration.version
  );
  if (duplicateVersion) {
    throw new Error(`Goose-Migrationsversion ${duplicateVersion.version} ist nicht eindeutig.`);
  }
  return expected;
};

export const resolveIamMigrationsDirectory = (
  environment: NodeJS.ProcessEnv = process.env
): string =>
  environment.MIGRATIONS_DIR?.trim() ||
  environment.SVA_MIGRATIONS_DIR?.trim() ||
  DEFAULT_MIGRATIONS_DIRECTORY;

export const resolveExpectedGooseMigrationFromDirectory = (
  migrationsDirectory = resolveIamMigrationsDirectory()
): ExpectedGooseMigration => {
  const resolvedMigrationsDirectory = resolve(migrationsDirectory);
  const cachedMigration = expectedMigrationByDirectory.get(resolvedMigrationsDirectory);
  if (cachedMigration) {
    return cachedMigration;
  }

  const expectedMigration = resolveExpectedGooseMigration(
    readdirSync(resolvedMigrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  );
  expectedMigrationByDirectory.set(resolvedMigrationsDirectory, expectedMigration);
  return expectedMigration;
};

export const buildIamDatabaseReadinessSql = (): string => {
  const schemaGuardSql = CRITICAL_IAM_SCHEMA_GUARD_SQL.trim().replace(/;$/u, '');
  return `
SELECT
  checks.*,
  (
    SELECT MAX(version_id)::text
    FROM public.goose_db_version
    WHERE is_applied = true
  ) AS current_migration_version
FROM (
${schemaGuardSql}
) checks;
`;
};

const toBoolean = (value: unknown) =>
  value === true || value === 't' || value === 'true' || value === 1;

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

export const evaluateIamDatabaseReadiness = (
  row: Record<string, unknown>,
  expectedMigration: ExpectedGooseMigration
): IamDatabaseReadinessReport => {
  const schema = evaluateCriticalIamSchemaGuard(row);
  const rawAppliedVersion = row.current_migration_version;
  const parsedAppliedVersion =
    typeof rawAppliedVersion === 'number'
      ? rawAppliedVersion
      : typeof rawAppliedVersion === 'string'
        ? Number.parseInt(rawAppliedVersion, 10)
        : Number.NaN;
  const appliedVersion = Number.isInteger(parsedAppliedVersion) ? parsedAppliedVersion : null;
  const migrationOk = appliedVersion !== null && appliedVersion >= expectedMigration.version;
  const migration: MigrationReadinessReport = {
    appliedVersion,
    expectedMigration: expectedMigration.fileName,
    expectedVersion: expectedMigration.version,
    ok: migrationOk,
    ...(migrationOk ? {} : { reasonCode: 'migration_drift' as const }),
  };

  return {
    migration,
    ok: migration.ok && schema.ok,
    schema,
  };
};

export const runCriticalIamSchemaGuard = async (
  client: QueryClient
): Promise<SchemaGuardReport> => {
  const result = await client.query<SchemaGuardRow>(CRITICAL_IAM_SCHEMA_GUARD_SQL);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return evaluateCriticalIamSchemaGuard(row ?? {});
};

export const runIamDatabaseReadiness = async (
  client: QueryClient,
  expectedMigration: ExpectedGooseMigration
): Promise<IamDatabaseReadinessReport> => {
  const result = await client.query<SchemaGuardRow & { current_migration_version: string | null }>(
    buildIamDatabaseReadinessSql()
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return evaluateIamDatabaseReadiness(row ?? {}, expectedMigration);
};

export const runIamDatabaseReadinessForConnection = async (
  config: ClientConfig,
  expectedMigration: ExpectedGooseMigration
): Promise<IamDatabaseReadinessReport> => {
  const client = new Client(config);
  try {
    await client.connect();
    return await runIamDatabaseReadiness(client as QueryClient, expectedMigration);
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const runGraphileWorkerReadinessForConnection = async (
  config: ClientConfig,
  appDbUser: string,
  workerDbUser: string
): Promise<GraphileWorkerReadinessReport> => {
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query<Record<string, unknown>>(GRAPHILE_WORKER_READINESS_SQL, [
      appDbUser,
      workerDbUser,
    ]);
    const row = result.rows[0] ?? {};
    const failedChecks = GRAPHILE_WORKER_READINESS_FIELDS.filter((field) => !toBoolean(row[field]));
    return { failedChecks, ok: failedChecks.length === 0 };
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const summarizeSchemaGuardFailures = (report: SchemaGuardReport): string | undefined => {
  const failed = report.checks.filter((check) => !check.ok);
  if (failed.length === 0) {
    return undefined;
  }

  return failed.map((check) => `${check.reasonCode}:${check.schemaObject}`).join(', ');
};

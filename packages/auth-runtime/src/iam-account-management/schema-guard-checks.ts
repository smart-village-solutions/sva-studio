import type { SchemaGuardCheck, SchemaGuardCheckKind } from './schema-guard.js';

export type SchemaGuardRow = {
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

export const REQUIRED_SCHEMA_CHECKS = [
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

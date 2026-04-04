import { describe, expect, it } from 'vitest';

import { evaluateCriticalIamSchemaGuard } from './schema-guard.js';

describe('evaluateCriticalIamSchemaGuard', () => {
  it('flags registry bootstrap drift when tenant auth registry columns are missing', () => {
    const report = evaluateCriticalIamSchemaGuard({
      groups_exists: true,
      group_roles_exists: true,
      account_groups_exists: true,
      activity_logs_exists: true,
      accounts_instance_id_column_exists: true,
      accounts_username_ciphertext_column_exists: true,
      accounts_avatar_url_column_exists: true,
      accounts_preferred_language_column_exists: true,
      accounts_timezone_column_exists: true,
      accounts_notes_column_exists: true,
      account_groups_origin_column_exists: true,
      instance_hostnames_exists: true,
      instance_hostnames_rls_disabled: false,
      instances_primary_hostname_column_exists: true,
      instances_rls_disabled: false,
      instances_auth_realm_column_exists: false,
      instances_auth_client_id_column_exists: false,
      instances_auth_issuer_url_column_exists: false,
      instances_auth_client_secret_ciphertext_column_exists: false,
      instances_tenant_admin_username_column_exists: false,
      instances_tenant_admin_email_column_exists: false,
      instances_tenant_admin_first_name_column_exists: false,
      instances_tenant_admin_last_name_column_exists: false,
      idx_accounts_kc_subject_instance_exists: true,
      accounts_isolation_policy_matches: true,
      instance_memberships_isolation_policy_matches: true,
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ok: false,
          reasonCode: 'policy_mismatch',
          schemaObject: 'policy:instance_hostnames_rls_disabled',
          expectedMigration: '0023_iam_disable_rls.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'policy_mismatch',
          schemaObject: 'policy:instances_rls_disabled',
          expectedMigration: '0023_iam_disable_rls.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'missing_column',
          schemaObject: 'iam.instances.auth_realm',
          expectedMigration: '0026_iam_instance_auth_config.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'missing_column',
          schemaObject: 'iam.instances.auth_client_id',
          expectedMigration: '0026_iam_instance_auth_config.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'missing_column',
          schemaObject: 'iam.instances.auth_issuer_url',
          expectedMigration: '0026_iam_instance_auth_config.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'missing_column',
          schemaObject: 'iam.instances.auth_client_secret_ciphertext',
          expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
        }),
        expect.objectContaining({
          ok: false,
          reasonCode: 'missing_column',
          schemaObject: 'iam.instances.tenant_admin_username',
          expectedMigration: '0027_iam_instance_keycloak_bootstrap.sql',
        }),
      ])
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  archiveSchemaCompatible,
  canonicalRequest,
  canonicalRestoreRequest,
  buildRuntimePrincipalReconciliationSql,
  controlKeysFor,
  extractAppliedGooseVersion,
  isHistoricalSchemaRestoreCompatible,
  isRestoreSqlLineSupported,
  minioAwsCompatibilityEnv,
  restoreControlKeysFor,
  runtimePrincipalProbeSql,
  restoreSchemaResetSql,
  runCommand,
  safeErrorCode,
  targets,
  validateRuntimePrincipalProbe,
  validateOidcClaims,
  validateDatabasePostchecks,
  validRequest,
  validRestoreRequest,
  validRequestHost,
  waitForSessionDrain,
} from './agent.mjs';

const request = {
  version: 1,
  action: 'backup-and-verify',
  requestId: 'gha-12345678',
  environment: 'staging',
  deployImageDigest: `sha256:${'a'.repeat(64)}`,
  expiresAt: '2026-07-30T10:10:00.000Z',
} as const;

describe('backup agent runtime contract', () => {
  it('binds GitHub identity to repository, environment and allowlisted main workflow', () => {
    process.env.BACKUP_AGENT_OIDC_AUDIENCE = 'studio-backup-agent';
    process.env.BACKUP_AGENT_GITHUB_REPOSITORY = 'smart-village-solutions/sva-studio';
    process.env.BACKUP_AGENT_ALLOWED_WORKFLOWS =
      'promote.yml,staging-backup-drill.yml,production-backup-drill.yml';
    const claims = {
      aud: 'studio-backup-agent',
      environment: 'staging',
      exp: 1_800,
      iss: 'https://token.actions.githubusercontent.com',
      nbf: 900,
      repository: 'smart-village-solutions/sva-studio',
      workflow_ref:
        'smart-village-solutions/sva-studio/.github/workflows/promote.yml@refs/heads/main',
    };
    expect(() => validateOidcClaims(claims, 'staging', 1_000)).not.toThrow();
    expect(() => validateOidcClaims({ ...claims, environment: 'prod' }, 'staging', 1_000)).toThrow(
      'oidc_environment_invalid'
    );
    expect(() =>
      validateOidcClaims(
        {
          ...claims,
          environment: 'prod',
          workflow_ref:
            'smart-village-solutions/sva-studio/.github/workflows/production-backup-drill.yml@refs/heads/main',
        },
        'prod',
        1_000
      )
    ).not.toThrow();
    expect(() =>
      validateOidcClaims(
        {
          ...claims,
          workflow_ref:
            'smart-village-solutions/sva-studio/.github/workflows/untrusted.yml@refs/heads/main',
        },
        'staging',
        1_000
      )
    ).toThrow('oidc_workflow_invalid');
    expect(() =>
      validateOidcClaims(
        {
          ...claims,
          job_workflow_ref: claims.workflow_ref,
          workflow_ref:
            'smart-village-solutions/sva-studio/.github/workflows/build.yml@refs/heads/main',
        },
        'staging',
        1_000
      )
    ).not.toThrow();
  });

  it('uses an action-specific workflow allowlist for restores', () => {
    process.env.BACKUP_AGENT_OIDC_AUDIENCE = 'studio-backup-agent';
    process.env.BACKUP_AGENT_GITHUB_REPOSITORY = 'smart-village-solutions/sva-studio';
    process.env.RESTORE_AGENT_ALLOWED_WORKFLOWS = 'database-restore.yml';
    const claims = {
      aud: 'studio-backup-agent',
      environment: 'staging',
      exp: 1_800,
      iss: 'https://token.actions.githubusercontent.com',
      nbf: 900,
      repository: 'smart-village-solutions/sva-studio',
      workflow_ref:
        'smart-village-solutions/sva-studio/.github/workflows/database-restore.yml@refs/heads/main',
    };
    expect(() =>
      validateOidcClaims(claims, 'staging', 1_000, 'restore-and-verify-v1')
    ).not.toThrow();
    expect(() =>
      validateOidcClaims(
        { ...claims, workflow_ref: request.action },
        'staging',
        1_000,
        'restore-and-verify-v1'
      )
    ).toThrow('oidc_workflow_invalid');
  });
  it('accepts only short-lived requests', () => {
    expect(validRequest(request, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(true);
    expect(
      validRequest(
        { ...request, expiresAt: '2026-07-30T10:10:00.001Z' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(false);
  });

  it('accepts production backups without maintenance evidence', () => {
    expect(
      validRequest(
        { ...request, version: 2, environment: 'prod' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(true);
    expect(
      validRequest(
        { ...request, environment: 'prod', maintenanceWindowReference: 'CAB-42' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(true);
    expect(
      validRequest(
        { ...request, version: 2, environment: 'prod', maintenanceWindowReference: 'CAB-42' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(false);
  });

  it('canonicalizes requests without accepting target overrides', () => {
    expect(canonicalRequest(request)).not.toContain('bucket');
    expect(canonicalRequest(request)).not.toContain('postgresHost');
    expect(
      validRequest(
        { ...request, bucket: 'studio-db-backup-production' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(false);
  });

  it('accepts only the dedicated host of the requested environment', () => {
    expect(validRequestHost('staging', 'backup-studio-staging.smart-village.app')).toBe(true);
    expect(validRequestHost('prod', 'backup-studio.smart-village.app')).toBe(true);
    expect(validRequestHost('staging', 'backup-studio.smart-village.app')).toBe(false);
    expect(validRequestHost('prod', 'studio.smart-village.app')).toBe(false);
    expect(validRequestHost('unknown', 'backup-studio-staging.smart-village.app')).toBe(false);
  });

  it('uses the verified Swarm DNS names for both database stacks', () => {
    expect(targets.staging.postgresHost).toBe('studio-staging_postgres');
    expect(targets.prod.postgresHost).toBe('studio_postgres');
    expect(targets.staging.schemaOwner).toBe('sva');
    expect(targets.staging.runtimeUser).toBe('sva_app');
    expect(targets.prod.schemaOwner).toBe('sva');
    expect(targets.prod.runtimeUser).toBe('sva_app');
  });

  it('builds a static restore reconciliation for the allowlisted runtime principal', () => {
    const sql = buildRuntimePrincipalReconciliationSql(targets.prod);

    expect(sql).toContain('SET ROLE "sva";');
    expect(sql).toContain('GRANT "iam_app" TO "sva_app";');
    expect(sql).toContain('GRANT USAGE ON SCHEMA iam TO "iam_app", "sva_app";');
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO "iam_app", "sva_app";'
    );
    expect(sql).toContain(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO "iam_app", "sva_app";'
    );
    expect(sql).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "sva" IN SCHEMA iam\n  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "iam_app", "sva_app";'
    );
    expect(sql).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "sva" IN SCHEMA iam\n  GRANT USAGE, SELECT ON SEQUENCES TO "iam_app", "sva_app";'
    );
    expect(sql).not.toContain('PASSWORD');
  });

  it('rejects target identities outside the internal restore allowlist', () => {
    expect(() =>
      buildRuntimePrincipalReconciliationSql({
        ...targets.prod,
        runtimeUser: 'attacker',
      })
    ).toThrow('runtime_principal_target_invalid');
  });

  it('probes complete table and sequence privileges for the login and switched role', () => {
    const sql = runtimePrincipalProbeSql(targets.prod);

    for (const principal of ["'sva_app'", "'iam_app'"]) {
      expect(sql).toContain(`has_table_privilege(${principal}, relation.oid, 'SELECT')`);
      expect(sql).toContain(`has_table_privilege(${principal}, relation.oid, 'INSERT')`);
      expect(sql).toContain(`has_table_privilege(${principal}, relation.oid, 'UPDATE')`);
      expect(sql).toContain(`has_table_privilege(${principal}, relation.oid, 'DELETE')`);
      expect(sql).toContain(`has_sequence_privilege(${principal}, sequence.oid, 'USAGE')`);
      expect(sql).toContain(`has_sequence_privilege(${principal}, sequence.oid, 'SELECT')`);
    }
    expect(sql).not.toContain("'USAGE,SELECT'");
    expect(sql.match(/\n    false\n/gmu)).toHaveLength(2);
    expect(sql.match(/\n    true\n/gmu)).toHaveLength(2);
  });

  it('uses persistent MinIO control keys for replay and terminal evidence', () => {
    expect(controlKeysFor('gha-12345678')).toEqual({
      request: 'control/requests/gha-12345678.json',
      result: 'control/results/gha-12345678.json',
    });
  });

  it('validates restore requests independently and stores separate evidence', () => {
    const restore = {
      version: 1,
      action: 'restore-and-verify-v1',
      requestId: 'restore-12345678',
      environment: 'staging',
      expiresAt: '2026-07-30T10:10:00.000Z',
      maintenanceWindowReference: 'INC-42',
      sourceObjectKey: `staging/2026-07-30/${'a'.repeat(64)}/backup.dump`,
      sourceSha256: 'b'.repeat(64),
    } as const;
    expect(validRestoreRequest(restore, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(true);
    expect(
      validRestoreRequest(
        { ...restore, sourceObjectKey: 'prod/backup.dump' },
        Date.parse('2026-07-30T10:00:00.000Z')
      )
    ).toBe(false);
    expect(canonicalRestoreRequest(restore)).not.toContain('postgres');
    expect(restoreControlKeysFor(restore.requestId)).toEqual({
      request: `control/restores/requests/${restore.requestId}.json`,
      safetyBackup: `control/restores/safety-backups/${restore.requestId}.json`,
      result: `control/restores/results/${restore.requestId}.json`,
    });
  });

  it('uses checksum settings compatible with the deployed MinIO endpoint', () => {
    expect(minioAwsCompatibilityEnv).toEqual({
      AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required',
      AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
    });
  });

  it('never propagates credentials or shell traces into terminal error codes', () => {
    expect(
      safeErrorCode(new Error('aws_failed_1:https://access:secret@minio/upload shell trace'))
    ).toBe('aws_failed_1');
    expect(safeErrorCode(new Error('password=secret'))).toBe('backup_failed');
    expect(safeErrorCode(new Error('pg_restore_timeout'))).toBe('pg_restore_timeout');
    expect(safeErrorCode(new Error('pg_restore_preflight_failed_1'))).toBe(
      'pg_restore_preflight_failed_1'
    );
    expect(safeErrorCode(new Error('database_postcheck_failed'))).toBe('database_postcheck_failed');
    expect(safeErrorCode(new Error('schema_version_mismatch'))).toBe('schema_version_mismatch');
    expect(safeErrorCode(new Error('runtime_principal_reconciliation_failed'))).toBe(
      'runtime_principal_reconciliation_failed'
    );
    expect(safeErrorCode(new Error('runtime_principal_probe_failed'))).toBe(
      'runtime_principal_probe_failed'
    );
  });

  it('extracts the newest applied Goose version from custom-dump SQL output', () => {
    const sql = [
      'COPY public.goose_db_version (id, version_id, is_applied, tstamp) FROM stdin;',
      '1\t2026073101\tt\t2026-07-31 10:00:00',
      '2\t2026080101\ttrue\t2026-08-01 10:00:00',
      '3\t2026080201\tf\t2026-08-02 10:00:00',
      '\\.',
    ].join('\n');
    expect(extractAppliedGooseVersion(sql)).toBe(2026080101);
    expect(extractAppliedGooseVersion('SELECT 1;')).toBeNull();
  });

  it('accepts historical schema versions but rejects dumps newer than the target', () => {
    expect(isHistoricalSchemaRestoreCompatible(70, 71)).toBe(true);
    expect(isHistoricalSchemaRestoreCompatible(71, 71)).toBe(true);
    expect(isHistoricalSchemaRestoreCompatible(72, 71)).toBe(false);
  });

  it('resets application-owned schemas before applying a historical dump', () => {
    expect(restoreSchemaResetSql('sva')).toBe(
      'SET ROLE "sva"; DROP SCHEMA IF EXISTS iam CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION "sva"; CREATE SCHEMA iam AUTHORIZATION "sva";'
    );
  });

  it('requires both migration and IAM registry structures in the restore archive', () => {
    expect(
      archiveSchemaCompatible('1; TABLE public goose_db_version sva\n2; TABLE iam instances sva\n')
    ).toBe(true);
    expect(archiveSchemaCompatible('1; TABLE public goose_db_version sva\n')).toBe(false);
  });

  it('removes only restore settings unsupported by the PostgreSQL 16 target', () => {
    expect(isRestoreSqlLineSupported('SET transaction_timeout = 0;')).toBe(false);
    expect(isRestoreSqlLineSupported('SET statement_timeout = 0;')).toBe(true);
    expect(isRestoreSqlLineSupported('SELECT 1;')).toBe(true);
  });

  it('fails closed while application sessions remain active', async () => {
    const readActiveSessions = vi.fn().mockResolvedValue('1');
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(
      waitForSessionDrain(targets.staging, {}, { attempts: 2, readActiveSessions, wait })
    ).rejects.toThrow('active_app_sessions');
    expect(readActiveSessions).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('continues only after all application sessions have drained', async () => {
    const readActiveSessions = vi.fn().mockResolvedValueOnce('2').mockResolvedValueOnce('0');
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(
      waitForSessionDrain(targets.staging, {}, { attempts: 2, readActiveSessions, wait })
    ).resolves.toBeUndefined();
  });

  it('rejects every incomplete database postcheck set', () => {
    const valid = {
      appPrincipal: '1',
      gooseVersion: '2026080101',
      iamSchema: 't',
      registryEntries: '1',
    };
    expect(() => validateDatabasePostchecks(valid)).not.toThrow();
    for (const invalid of [
      { ...valid, appPrincipal: '0' },
      { ...valid, gooseVersion: '' },
      { ...valid, iamSchema: 'f' },
      { ...valid, registryEntries: 'invalid' },
    ])
      expect(() => validateDatabasePostchecks(invalid)).toThrow('database_postcheck_failed');
  });

  it('accepts only a complete runtime-principal probe', () => {
    const valid = {
      databaseConnect: true,
      roleMembership: true,
      runtimeUserSchemaUsage: true,
      runtimeRoleSchemaUsage: true,
      runtimeUserTablesReady: true,
      runtimeRoleTablesReady: true,
      runtimeUserSequencesReady: true,
      runtimeRoleSequencesReady: true,
    };

    expect(validateRuntimePrincipalProbe(valid)).toEqual(valid);
    for (const key of Object.keys(valid)) {
      expect(() => validateRuntimePrincipalProbe({ ...valid, [key]: false })).toThrow(
        'runtime_principal_probe_failed'
      );
    }
    expect(() => validateRuntimePrincipalProbe({ ...valid, databaseConnect: 't' })).toThrow(
      'runtime_principal_probe_failed'
    );
  });

  it('terminates an external command after its explicit deadline', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { timeoutMs: 25 })
    ).rejects.toThrow(`${process.execPath}_timeout`);
  });
});

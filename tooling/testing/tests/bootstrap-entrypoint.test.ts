import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(testDir, '../../..');
const bootstrapEntrypointPath = resolve(rootDir, 'deploy/portainer/bootstrap-entrypoint.sh');

const renderBootstrapSql = (
  envOverrides: NodeJS.ProcessEnv = {},
  useDefaultSchemaGuard = false
) => {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'sva-bootstrap-entrypoint-test-'));
  const fakeBinDir = resolve(tempDir, 'bin');
  const outputSqlPath = resolve(tempDir, 'bootstrap.sql');
  const fakeNodePath = resolve(fakeBinDir, 'node');
  const fakePsqlPath = resolve(fakeBinDir, 'psql');

  try {
    mkdirSync(fakeBinDir, { recursive: true });
    writeFileSync(
      fakePsqlPath,
      `#!/usr/bin/env bash
set -euo pipefail
sql_file=""
while (($#)); do
  case "$1" in
    -f)
      sql_file="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
cp "$sql_file" "$OUTPUT_SQL_PATH"
`,
      'utf8'
    );
    chmodSync(fakePsqlPath, 0o755);
    writeFileSync(
      fakeNodePath,
      `#!/usr/bin/env bash
if [ "\${1:-}" = "./verify-iam-schema.mjs" ]; then
  printf '[test-verifier] invoked\\n'
  exit 0
fi
exec "${process.execPath}" "$@"
`,
      'utf8'
    );
    chmodSync(fakeNodePath, 0o755);

    const environment = { ...process.env };
    delete environment.SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD;

    const result = spawnSync('bash', [bootstrapEntrypointPath], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...environment,
        ...envOverrides,
        APP_DB_PASSWORD: 'app-password',
        STUDIO_JOB_WORKER_DB_PASSWORD: 'worker-password',
        OUTPUT_SQL_PATH: outputSqlPath,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ''}`,
        POSTGRES_DB: 'sva_studio',
        POSTGRES_PASSWORD: 'postgres-password',
        POSTGRES_USER: 'sva',
        SVA_ALLOWED_INSTANCE_IDS: 'bb-guben,de-musterhausen',
        ...(useDefaultSchemaGuard ? {} : { SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD: 'false' }),
        SVA_PARENT_DOMAIN: 'studio.smart-village.app',
      },
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    if (useDefaultSchemaGuard) {
      expect(result.stdout).toContain('[test-verifier] invoked');
    }
    return readFileSync(outputSqlPath, 'utf8');
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

describe('bootstrap-entrypoint', () => {
  it('runs the schema guard by default when no override is configured', () => {
    renderBootstrapSql({}, true);
  });

  it('separates enqueue-only app privileges from worker execution privileges', () => {
    const sql = renderBootstrapSql({}, true);

    expect(sql).toContain('GRANT CONNECT ON DATABASE "sva_studio" TO "sva_app";');
    expect(sql).toContain('REVOKE CREATE ON DATABASE "sva_studio" FROM "sva_app";');
    expect(sql).toContain('REVOKE CREATE ON SCHEMA public FROM "sva_app";');
    expect(sql).toContain(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION graphile_worker.sva_enqueue_job(text, json, text, integer, text, timestamptz) TO "sva_app";'
    );
    expect(sql).not.toContain(
      'GRANT EXECUTE ON FUNCTION graphile_worker.add_job(text, json, text, timestamptz, integer, text, integer, text[], text) TO "sva_app";'
    );
    expect(sql).toContain('SET LOCAL ROLE "sva_app";');
    expect(sql).toContain("'studio-job:bootstrap-contract'");
    expect(sql).toContain('ROLLBACK;');
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA graphile_worker TO "sva_job_worker";'
    );
    expect(sql).toContain(
      'CREATE POLICY sva_job_worker_access ON graphile_worker.%I TO %I USING (true) WITH CHECK (true)'
    );
    expect(sql).toContain('worker_functions_complete');
    expect(sql).toContain('worker_sequences_complete');
    expect(sql).toContain('worker_policies_complete');
    expect(sql).not.toContain('BYPASSRLS');
  });

  it('reconciles worker privileges when app-role reconciliation is disabled', () => {
    const sql = renderBootstrapSql({ SVA_BOOTSTRAP_RECONCILE_APP_ROLE: 'false' }, true);

    expect(sql).not.toContain('GRANT iam_app TO "sva_app";');
    expect(sql).toContain('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER');
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA graphile_worker TO "sva_job_worker";'
    );
    expect(sql).toContain('worker_policies_complete');
  });

  it('backfills tenant_admin_client_id in bootstrap instance reconciliation SQL', () => {
    const sql = renderBootstrapSql();

    expect(sql).toContain(
      'INSERT INTO iam.instances (id, display_name, status, parent_domain, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id)'
    );
    expect(sql).toContain("'sva-studio-admin'");
    expect(sql).toContain(
      "tenant_admin_client_id = COALESCE(NULLIF(iam.instances.tenant_admin_client_id, ''), EXCLUDED.tenant_admin_client_id)"
    );
  });

  it('reconciles canonical tenant permissions and system_admin grants additively', () => {
    const sql = renderBootstrapSql();

    expect(sql).toContain("'iam.accounts.delete'");
    expect(sql).toContain("'instance_permission_catalog_reconciled'");
    expect(sql).toContain('FROM iam.instance_modules instance_module');
    expect(sql).toContain('ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING');
    expect(sql).not.toContain('DELETE FROM iam.permissions');
    expect(sql).not.toContain('DELETE FROM iam.role_permissions');
  });
});

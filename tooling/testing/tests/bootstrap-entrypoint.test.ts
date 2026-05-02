import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(testDir, '../../..');
const bootstrapEntrypointPath = resolve(rootDir, 'deploy/portainer/bootstrap-entrypoint.sh');

const renderBootstrapSql = (envOverrides: NodeJS.ProcessEnv = {}) => {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'sva-bootstrap-entrypoint-test-'));
  const fakeBinDir = resolve(tempDir, 'bin');
  const outputSqlPath = resolve(tempDir, 'bootstrap.sql');
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
      'utf8',
    );
    chmodSync(fakePsqlPath, 0o755);

    const result = spawnSync('bash', [bootstrapEntrypointPath], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...envOverrides,
        APP_DB_PASSWORD: 'app-password',
        OUTPUT_SQL_PATH: outputSqlPath,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ''}`,
        POSTGRES_DB: 'sva_studio',
        POSTGRES_PASSWORD: 'postgres-password',
        POSTGRES_USER: 'sva',
        SVA_ALLOWED_INSTANCE_IDS: 'bb-guben,de-musterhausen',
        SVA_PARENT_DOMAIN: 'studio.smart-village.app',
      },
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    return readFileSync(outputSqlPath, 'utf8');
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

describe('bootstrap-entrypoint', () => {
  it('seeds canonical auth realm and client identifiers in bootstrap instance reconciliation SQL', () => {
    const sql = renderBootstrapSql();

    expect(sql).toContain(
      'INSERT INTO iam.instances (id, display_name, status, parent_domain, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id)',
    );
    expect(sql).toContain(
      "'bb-guben', 'bb-guben', 'active', 'studio.smart-village.app', 'bb-guben.studio.smart-village.app', 'bb-guben', 'sva-studio', 'sva-studio-admin'"
    );
    expect(sql).toContain(
      'auth_client_id = EXCLUDED.auth_client_id',
    );
    expect(sql).toContain(
      "tenant_admin_client_id = COALESCE(NULLIF(iam.instances.tenant_admin_client_id, ''), EXCLUDED.tenant_admin_client_id)",
    );
  });
});

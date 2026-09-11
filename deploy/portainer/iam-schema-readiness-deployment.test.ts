import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/auth-runtime/server', () => ({
  revealField: () => 'redacted-test-secret',
}));

const readRepoFile = (path: string) =>
  readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

describe('IAM schema readiness deployment contract', () => {
  const bootstrapEntrypoint = readRepoFile('deploy/portainer/bootstrap-entrypoint.sh');
  it.each(['studio', 'auth', 'admin', 'tenant'])('validates bootstrap host %s before emitting SQL', (id) => {
    const program = bootstrapEntrypoint.split("<<'NODE'")[1]?.split('\n').slice(1).join('\n').split('\nNODE\n')[0];
    expect(program).toBeTruthy();
    const result = spawnSync(process.execPath, ['--input-type=module'], {
      cwd: resolve(import.meta.dirname, '../..'),
      input: program,
      encoding: 'utf8',
      env: { ...process.env, APP_DB_PASSWORD: 'test-only', STUDIO_JOB_WORKER_DB_PASSWORD: 'test-only',
        SVA_PARENT_DOMAIN: 'example.org', SVA_STUDIO_ROOT_HOST: 'admin.example.org', SVA_ALLOWED_INSTANCE_IDS: id },
    });
    if (id === 'tenant') {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('tenant.example.org');
      return;
    }
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Bootstrap-Tenant-Hostname ist ungültig oder reserviert.');
    expect(result.stdout).toBe('');
  });

  const candidatePreflight = readRepoFile('deploy/portainer/candidate-preflight.mjs');
  const migrateEntrypoints = [
    readRepoFile('migrate-entrypoint.sh'),
    readRepoFile('deploy/portainer/migrate-entrypoint.sh'),
  ];
  const appEntrypoints = [
    readRepoFile('entrypoint.sh'),
    readRepoFile('deploy/portainer/entrypoint.sh'),
  ];
  const provisionerEntrypoints = [
    readRepoFile('provisioner-entrypoint.sh'),
    readRepoFile('deploy/portainer/provisioner-entrypoint.sh'),
  ];
  const dockerfiles = [readRepoFile('Dockerfile'), readRepoFile('deploy/portainer/Dockerfile')];
  const localBootstrap = readRepoFile('packages/data/scripts/bootstrap-app-user.sh');
  const runtimeArtifactVerifier = readRepoFile('scripts/ci/verify-runtime-artifact.sh');
  const verifier = readRepoFile('deploy/portainer/verify-iam-schema.mjs');
  const standaloneProvisioner = readRepoFile('deploy/standalone/keycloak-provisioner.compose.yml');
  const standaloneUp = readRepoFile('deploy/standalone/up.sh');
  const standaloneRunbook = readRepoFile('docs/operations/ssf-standalone-hosts.md');

  it('ships the standalone Keycloak provisioner as a digest-bound internal service', () => {
    expect(standaloneProvisioner).toContain('provisioner:');
    expect(standaloneProvisioner.match(/image: \$\{SVA_IMAGE_REF:/gu)).toHaveLength(2);
    expect(standaloneProvisioner).toContain('./provisioner-entrypoint.sh');
    expect(standaloneProvisioner).toContain('command:');
    expect(standaloneProvisioner).toContain(
      'node_modules/@sva/auth-runtime/dist/iam-instance-registry/worker.js'
    );
    expect(standaloneProvisioner).toContain('./runtime.env');
    expect(standaloneProvisioner).toContain('name: sva-studio-ssf_internal');
    expect(standaloneProvisioner).toContain('name: ssf-backend_default');
    expect(standaloneProvisioner).not.toContain('ports:');
    expect(standaloneProvisioner).not.toContain('traefik');
    expect(standaloneRunbook).toContain('keycloak-provisioner.compose.yml');
    expect(standaloneRunbook).toContain('ps app provisioner');
  });

  it.each([
    '',
    'ghcr.io/smart-village-solutions/sva-studio:latest',
    `ghcr.io/smart-village-solutions/sva-studio@sha256:${'a'.repeat(63)}`,
    `ghcr.io/smart-village-solutions/sva-studio@sha256:${'A'.repeat(64)}`,
  ])('rejects mutable or malformed standalone image reference %s', (imageRef) => {
    const result = spawnSync('sh', ['deploy/standalone/up.sh', '--validate-only'], {
      cwd: resolve(import.meta.dirname, '../..'),
      encoding: 'utf8',
      env: { ...process.env, SVA_IMAGE_REF: imageRef },
    });
    expect(result.status).toBe(64);
  });

  it('accepts a full immutable standalone image reference', () => {
    const result = spawnSync('sh', ['deploy/standalone/up.sh', '--validate-only'], {
      cwd: resolve(import.meta.dirname, '../..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        SVA_IMAGE_REF: `ghcr.io/smart-village-solutions/sva-studio@sha256:${'a'.repeat(64)}`,
      },
    });
    expect(result.status).toBe(0);
    expect(standaloneUp).toContain('-f app.compose.yml');
    expect(standaloneUp).toContain('-f keycloak-provisioner.compose.yml');
    expect(standaloneUp).toContain('up -d app provisioner');
  });

  it('ships one canonical verifier in both runtime images', () => {
    for (const dockerfile of dockerfiles) {
      expect(dockerfile).toContain('verify-iam-schema.mjs');
    }
    expect(verifier).toContain('@sva/auth-runtime/schema-guard');
    expect(verifier).toContain('runGraphileWorkerReadinessForConnection');
    expect(verifier).not.toContain("from 'pg'");
    expect(verifier).not.toContain("to_regclass('iam.instance_waste_data_sources')");
  });

  it('runs the verifier after migration and bootstrap and before app startup', () => {
    for (const entrypoint of migrateEntrypoints) {
      expect(entrypoint.indexOf('goosew.sh')).toBeLessThan(
        entrypoint.indexOf('node ./verify-iam-schema.mjs --iam-only')
      );
      expect(entrypoint).toContain('node ./verify-iam-schema.mjs --iam-only');
    }
    expect(bootstrapEntrypoint).not.toContain('DO $schema_guard$');
    expect(bootstrapEntrypoint).toContain('node ./verify-iam-schema.mjs');
    expect(bootstrapEntrypoint).not.toContain('node ./verify-iam-schema.mjs --iam-only');
    for (const entrypoint of appEntrypoints) {
      expect(entrypoint).toContain('node ./verify-iam-schema.mjs');
      expect(entrypoint).not.toContain('node ./verify-iam-schema.mjs --iam-only');
      expect(entrypoint.indexOf('node ./verify-iam-schema.mjs')).toBeLessThan(
        entrypoint.lastIndexOf('exec "$@"')
      );
    }
    for (const entrypoint of provisionerEntrypoints) {
      expect(entrypoint.indexOf('node ./verify-iam-schema.mjs')).toBeLessThan(
        entrypoint.indexOf('iam-instance-registry/worker.js')
      );
    }
  });

  it('uses stable phase exit codes when remote logs are unavailable', () => {
    expect(candidatePreflight).toContain("code: 'PROMOTE_PREFLIGHT_CONFIG_INVALID'");
    expect(candidatePreflight).toContain('exitCode: 24');
    expect(candidatePreflight).toContain('process.exitCode = failure.exitCode');
    for (const entrypoint of migrateEntrypoints) {
      expect(entrypoint).toContain('"${GOOSE_CONFIG_PATH}")" || exit 36');
      expect(entrypoint).toContain('postgres "${db_string}" up || exit 32');
      expect(entrypoint).toContain('node "${GRAPHILE_WORKER_MIGRATOR}" || exit 33');
      expect(entrypoint).toContain('node ./verify-iam-schema.mjs --iam-only || exit 34');
      expect(entrypoint).toContain('node "${WASTE_TENANT_MIGRATOR}" || exit 35');
    }
    expect(bootstrapEntrypoint).toContain('-f "${tmp_sql}" || exit 43');
    expect(bootstrapEntrypoint).toContain('node ./verify-iam-schema.mjs || exit 44');
  });

  it('classifies candidate failures from one rule source', async () => {
    const { classifyCandidateFailure } = await import('./candidate-preflight.mjs');

    expect(classifyCandidateFailure('candidate_release_tenant_scope_missing')).toEqual(
      expect.objectContaining({
        code: 'PROMOTE_PREFLIGHT_TENANT_SCOPE_MISMATCH',
        exitCode: 22,
      })
    );
    expect(classifyCandidateFailure('candidate_runtime_profile_mismatch')).toEqual(
      expect.objectContaining({ code: 'PROMOTE_PREFLIGHT_CONFIG_INVALID', exitCode: 24 })
    );
    expect(classifyCandidateFailure('unexpected')).toEqual({
      code: 'PROMOTE_INTERNAL_ERROR',
      exitCode: 25,
    });
  });

  it('grants only the migration-ledger columns required by the app verifier', () => {
    for (const bootstrap of [bootstrapEntrypoint, localBootstrap]) {
      expect(bootstrap).toContain(
        'GRANT SELECT (version_id, is_applied) ON TABLE public.goose_db_version'
      );
      expect(bootstrap).not.toContain('GRANT SELECT ON TABLE public.goose_db_version');
    }
  });

  it('provides the migration directory when verifying the final app artifact', () => {
    expect(runtimeArtifactVerifier).toContain(
      'MIGRATIONS_DIR="${WORKSPACE_ROOT}/packages/data/migrations"'
    );
  });

  it('retains the schema guard default when no migration directory is configured', () => {
    expect(verifier).toMatch(
      /migrationsDirectory\s*\?\s*resolveExpectedGooseMigrationFromDirectory\(migrationsDirectory\)\s*:\s*resolveExpectedGooseMigrationFromDirectory\(\)/
    );
  });
});

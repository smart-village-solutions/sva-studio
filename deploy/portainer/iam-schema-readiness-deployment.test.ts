import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (path: string) =>
  readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

describe('IAM schema readiness deployment contract', () => {
  const bootstrapEntrypoint = readRepoFile('deploy/portainer/bootstrap-entrypoint.sh');
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
        entrypoint.indexOf('node ./verify-iam-schema.mjs')
      );
    }
    expect(bootstrapEntrypoint).not.toContain('DO $schema_guard$');
    expect(bootstrapEntrypoint).toContain('node ./verify-iam-schema.mjs');
    for (const entrypoint of appEntrypoints) {
      expect(entrypoint).toContain('node ./verify-iam-schema.mjs');
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

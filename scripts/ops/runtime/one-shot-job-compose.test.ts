import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

import { buildBootstrapJobComposeDocument } from './bootstrap-job.ts';
import { buildMigrationJobComposeDocument } from './migration-job.ts';

const renderedCompose = {
  name: 'studio-staging',
  services: {
    app: { image: 'example/app' },
    bootstrap: { environment: { EXISTING: 'value' }, image: 'example/app' },
    migrate: { environment: { GOOSE_DRIVER: 'postgres' }, image: 'example/app' },
    postgres: { image: 'postgres:16' },
    redis: { image: 'redis:7' },
  },
} as const;

const input = {
  internalNetworkName: 'studio-staging_internal',
  jobStackName: 'studio-staging-migrate-gha-123-1',
  sourceStackName: 'studio-staging',
  targetReplicas: 1,
};

describe('one-shot job compose documents', () => {
  it.each([
    ['migration', () => buildMigrationJobComposeDocument(renderedCompose, input), 'migrate', 'SVA_MIGRATION_JOB_STACK'],
    ['bootstrap', () => buildBootstrapJobComposeDocument(renderedCompose, input), 'bootstrap', 'SVA_BOOTSTRAP_JOB_STACK'],
  ] as const)('renders an isolated %s document', (_kind, build, serviceName, stackVariable) => {
    const document = build();
    const service = document.services?.[serviceName] as Record<string, unknown>;
    const environment = service.environment as Record<string, string>;

    expect(Object.keys(document.services ?? {})).toEqual([serviceName]);
    expect(document.networks).toEqual({ internal: { external: true, name: 'studio-staging_internal' } });
    expect(service.networks).toEqual(['internal']);
    expect(environment.POSTGRES_HOST).toBe('studio-staging_postgres');
    expect(environment[stackVariable]).toBe(input.jobStackName);
    expect(document.services).not.toHaveProperty('app');
    expect(document.services).not.toHaveProperty('postgres');
    expect(document.services).not.toHaveProperty('redis');
  });

  it('renders the staging Compose source into isolated one-shot documents', () => {
    try {
      execFileSync('docker', ['compose', 'version'], { stdio: 'ignore' });
    } catch {
      return;
    }
    const rendered = JSON.parse(execFileSync('docker', ['compose', '-f', 'compose.yaml', '-f', 'deploy/compose.staging.yaml', 'config', '--format', 'json'], {
      cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, IMAGE_REF: 'example.invalid/studio@sha256:deadbeef', SVA_RUNTIME_PROFILE: 'studio' }, stdio: ['ignore', 'pipe', 'pipe'],
    })) as Parameters<typeof buildMigrationJobComposeDocument>[0];

    const migration = buildMigrationJobComposeDocument(rendered, input);
    const bootstrap = buildBootstrapJobComposeDocument(rendered, { ...input, jobStackName: 'studio-staging-bootstrap-gha-123-1' });

    expect(Object.keys(migration.services ?? {})).toEqual(['migrate']);
    expect(Object.keys(bootstrap.services ?? {})).toEqual(['bootstrap']);
    expect(migration.networks?.internal).toEqual({ external: true, name: 'studio-staging_internal' });
    expect(bootstrap.networks?.internal).toEqual({ external: true, name: 'studio-staging_internal' });
  });
});

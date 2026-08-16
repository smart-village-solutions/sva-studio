import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const compose = readFileSync(resolve(import.meta.dirname, 'docker-compose.studio.yml'), 'utf8');
const canonicalCompose = readFileSync(resolve(import.meta.dirname, '../../compose.yaml'), 'utf8');
const entrypoint = readFileSync(resolve(import.meta.dirname, 'provisioner-entrypoint.sh'), 'utf8');
const migrationEntrypoint = readFileSync(
  resolve(import.meta.dirname, 'migrate-entrypoint.sh'),
  'utf8'
);
const dockerfile = readFileSync(resolve(import.meta.dirname, 'Dockerfile'), 'utf8');
const canonicalDockerfile = readFileSync(resolve(import.meta.dirname, '../../Dockerfile'), 'utf8');
const appSection = compose.slice(compose.indexOf('  app:'), compose.indexOf('  provisioner:'));
const canonicalAppSection = canonicalCompose.slice(
  canonicalCompose.indexOf('  app:'),
  canonicalCompose.indexOf('  provisioner:')
);
const provisionerSection = compose.slice(
  compose.indexOf('  provisioner:'),
  compose.indexOf('  migrate:')
);
const migrateSection = compose.slice(
  compose.indexOf('  migrate:'),
  compose.indexOf('  bootstrap:')
);
const canonicalMigrateSection = canonicalCompose.slice(
  canonicalCompose.indexOf('  migrate:'),
  canonicalCompose.indexOf('  bootstrap:')
);
const servicesSection = compose.slice(compose.indexOf('services:'), compose.indexOf('\nnetworks:'));

describe('waste tenant database provisioning deployment', () => {
  it('keeps cluster credentials out of the normal app worker', () => {
    expect(appSection).toContain("SVA_PLUGIN_OPERATION_WORKER_LANE: 'default'");
    expect(appSection).not.toContain('POSTGRES_PASSWORD');
    expect(appSection).not.toContain('WASTE_DATABASE_PROVISIONER');
  });

  it('injects the permission snapshot HMAC secret into both Studio app definitions', () => {
    expect(appSection).toContain("REDIS_SNAPSHOT_HMAC_SECRET: '${REDIS_SNAPSHOT_HMAC_SECRET}'");
    expect(canonicalAppSection).toContain(
      '"REDIS_SNAPSHOT_HMAC_SECRET=${REDIS_SNAPSHOT_HMAC_SECRET}"'
    );
  });

  it('defaults Mainserver authoring to shadow evaluation and a rollback-compatible client transition', () => {
    expect(appSection).toContain(
      "SVA_MAINSERVER_SCOPE_RESOLVER_MODE: '${SVA_MAINSERVER_SCOPE_RESOLVER_MODE:-shadow}'"
    );
    expect(appSection).toContain(
      "SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE: '${SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE:-legacy_compatible}'"
    );
    expect(appSection).toContain(
      "SVA_MAINSERVER_CONFIRMED_CAPABILITIES: '${SVA_MAINSERVER_CONFIRMED_CAPABILITIES:-}'"
    );
    expect(canonicalAppSection).toContain(
      '"SVA_MAINSERVER_SCOPE_RESOLVER_MODE=${SVA_MAINSERVER_SCOPE_RESOLVER_MODE:-shadow}"'
    );
  });

  it('uses the existing provisioner service and a protected secret for privileged jobs', () => {
    expect(provisionerSection).toContain("SVA_PROVISIONER_COMBINED_WORKER: 'true'");
    expect(provisionerSection).toContain("SVA_PLUGIN_OPERATION_WORKER_LANE: 'privileged'");
    expect(provisionerSection).toContain('/run/secrets/waste_database_provisioner_password');
    expect(provisionerSection).toContain('.output/server/index.mjs');
    expect(servicesSection.match(/^ {2}[a-z][a-z0-9-]+:$/gmu)).toEqual([
      '  app:',
      '  provisioner:',
      '  migrate:',
      '  bootstrap:',
      '  redis:',
      '  postgres:',
    ]);
  });

  it('reconciles the least-privileged role before supervising both existing workers', () => {
    expect(entrypoint).toContain('NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOINHERIT');
    expect(entrypoint).toContain('iam-instance-registry/worker.js');
    expect(entrypoint).toContain('./entrypoint.sh "$@"');
    expect(entrypoint).not.toContain(
      'WASTE_DATABASE_PROVISIONER_URL="postgresql://${POSTGRES_USER}'
    );
  });

  it('mounts the Waste provisioner secret into the isolated migration one-shot', () => {
    for (const section of [migrateSection, canonicalMigrateSection]) {
      expect(section).toContain('WASTE_DATABASE_PROVISIONER_USER');
      expect(section).toContain('/run/secrets/waste_database_provisioner_password');
      expect(section).toContain('waste_database_provisioner_password');
    }
  });

  it('ships and invokes the digest-bound versioned Waste migrator after Goose', () => {
    for (const source of [dockerfile, canonicalDockerfile]) {
      expect(source).toContain('migrate-waste-tenants.mjs');
    }
    expect(migrationEntrypoint.indexOf('goosew.sh')).toBeLessThan(
      migrationEntrypoint.indexOf('node "${WASTE_TENANT_MIGRATOR}"')
    );
  });
});

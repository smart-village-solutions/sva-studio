import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const compose = readFileSync(resolve(import.meta.dirname, 'docker-compose.studio.yml'), 'utf8');
const genericCompose = readFileSync(resolve(import.meta.dirname, 'docker-compose.yml'), 'utf8');
const canonicalCompose = readFileSync(resolve(import.meta.dirname, '../../compose.yaml'), 'utf8');
const environmentComposes = ['dev', 'staging', 'prod'].map((environment) => ({
  environment,
  source: readFileSync(
    resolve(import.meta.dirname, `../../deploy/compose.${environment}.yaml`),
    'utf8'
  ),
}));
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
const canonicalProvisionerSection = canonicalCompose.slice(
  canonicalCompose.indexOf('  provisioner:'),
  canonicalCompose.indexOf('  migrate:')
);
const migrateSection = compose.slice(
  compose.indexOf('  migrate:'),
  compose.indexOf('  bootstrap:')
);
const canonicalMigrateSection = canonicalCompose.slice(
  canonicalCompose.indexOf('  migrate:'),
  canonicalCompose.indexOf('  bootstrap:')
);
const genericMigrateSection = genericCompose.slice(
  genericCompose.indexOf('  migrate:'),
  genericCompose.indexOf('  bootstrap:')
);
const servicesSection = compose.slice(compose.indexOf('services:'), compose.indexOf('\nnetworks:'));

const serviceSection = (source: string, serviceName: string) => {
  const start = source.indexOf(`  ${serviceName}:`);
  if (start === -1) throw new Error(`Service ${serviceName} fehlt im Compose-Vertrag.`);
  const remaining = source.slice(start + 1);
  const nextService = remaining.search(/\n {2}[a-z][a-z0-9-]+:/u);
  return source.slice(start, nextService === -1 ? undefined : start + 1 + nextService);
};

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

  it('keeps the privileged provisioner fail-closed and privately restartable', () => {
    expect(provisionerSection).toContain("SVA_PLUGIN_OPERATION_WORKER_LANE: 'privileged'");
    expect(provisionerSection).toContain(
      "fetch('http://127.0.0.1:3000/health/ready').then((r)=>process.exit(r.ok?0:1))"
    );
    expect(provisionerSection).toContain('restart_policy:');
    expect(provisionerSection).toContain('condition: any');
    expect(provisionerSection).not.toContain('max_attempts:');
    expect(provisionerSection).toContain('- internal');
    expect(provisionerSection).not.toContain('traefik.enable');
    expect(provisionerSection).not.toContain('ports:');
  });

  it('routes only the instance creation control plane to the private provisioner boundary', () => {
    expect(appSection).toContain(
      "SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL: 'http://provisioner:3000'"
    );
    expect(canonicalAppSection).toContain(
      '"SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL=http://provisioner:3000"'
    );
    expect(appSection).not.toContain('KEYCLOAK_PROVISIONER_CLIENT_SECRET');
    expect(canonicalAppSection).not.toContain('KEYCLOAK_PROVISIONER_CLIENT_SECRET');
    expect(provisionerSection).toContain("SVA_TRUST_FORWARDED_HEADERS: 'true'");
    expect(canonicalProvisionerSection).toContain('"SVA_TRUST_FORWARDED_HEADERS=true"');
    for (const key of [
      'SVA_AUTH_ISSUER',
      'SVA_AUTH_CLIENT_ID',
      'SVA_AUTH_REDIRECT_URI',
      'SVA_AUTH_POST_LOGOUT_REDIRECT_URI',
      'SVA_STUDIO_MCP_ENABLED',
      'SVA_STUDIO_MCP_ISSUER',
      'SVA_STUDIO_MCP_AUDIENCE',
      'SVA_STUDIO_MCP_CLIENT_ID',
      'IAM_CSRF_ALLOWED_ORIGINS',
      'SVA_PARENT_DOMAIN',
      'SVA_STUDIO_ROOT_HOST',
      'SVA_ALLOWED_INSTANCE_IDS',
      'IAM_ADMIN_ENABLED',
    ]) {
      expect(provisionerSection, `reference provisioner ${key}`).toContain(`${key}:`);
      expect(canonicalProvisionerSection, `canonical provisioner ${key}`).toContain(`"${key}=`);
    }
    expect(provisionerSection).not.toContain('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL');
    expect(canonicalProvisionerSection).not.toContain('SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL');
  });

  it('replaces the single provisioner without mixed worker digests', () => {
    for (const environment of ['dev', 'staging', 'prod']) {
      const environmentCompose = readFileSync(
        resolve(import.meta.dirname, `../compose.${environment}.yaml`),
        'utf8'
      );
      const environmentProvisioner = environmentCompose.slice(
        environmentCompose.indexOf('  provisioner:'),
        environmentCompose.indexOf('  migrate:')
      );

      expect(environmentProvisioner).toContain('replicas: 1');
      expect(environmentProvisioner).toContain('parallelism: 1');
      expect(environmentProvisioner).toContain('order: stop-first');
      expect(environmentProvisioner).toContain('failure_action: pause');
    }
  });

  it('restarts every long-running Studio service without an attempt limit', () => {
    for (const serviceName of ['app', 'provisioner', 'redis', 'postgres']) {
      const referenceSection = serviceSection(compose, serviceName);
      expect(referenceSection, `${serviceName} reference restart condition`).toContain(
        'condition: any'
      );
      expect(referenceSection, `${serviceName} reference restart limit`).not.toContain(
        'max_attempts:'
      );
      expect(referenceSection, `${serviceName} reference restart window`).not.toContain('window:');

      for (const { environment, source } of environmentComposes) {
        const environmentSection = serviceSection(source, serviceName);
        expect(environmentSection, `${environment} ${serviceName} restart condition`).toContain(
          'condition: any'
        );
        expect(environmentSection, `${environment} ${serviceName} restart limit`).not.toContain(
          'max_attempts:'
        );
        expect(environmentSection, `${environment} ${serviceName} restart window`).not.toContain(
          'window:'
        );
      }
    }
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
      expect(section).toContain('WASTE_TENANT_MIGRATIONS_ENABLED');
      expect(section).toContain('WASTE_DATABASE_PROVISIONER_USER');
      expect(section).toContain('/run/secrets/waste_database_provisioner_password');
      expect(section).toContain('waste_database_provisioner_password');
    }
    expect(genericMigrateSection).not.toContain('WASTE_TENANT_MIGRATIONS_ENABLED');
    expect(genericMigrateSection).not.toContain('WASTE_DATABASE_PROVISIONER');
  });

  it('ships and invokes the digest-bound versioned Waste migrator after Goose', () => {
    for (const source of [dockerfile, canonicalDockerfile]) {
      expect(source).toContain('migrate-waste-tenants.mjs');
      expect(source).toContain('waste-tenant-migration-catalog.mjs');
    }
    expect(migrationEntrypoint.indexOf('goosew.sh')).toBeLessThan(
      migrationEntrypoint.indexOf('node "${WASTE_TENANT_MIGRATOR}"')
    );
    expect(migrationEntrypoint).toContain('${WASTE_TENANT_MIGRATIONS_ENABLED:-false}');
  });
});

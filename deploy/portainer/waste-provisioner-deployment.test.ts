import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const compose = readFileSync(resolve(import.meta.dirname, 'docker-compose.studio.yml'), 'utf8');
const entrypoint = readFileSync(resolve(import.meta.dirname, 'provisioner-entrypoint.sh'), 'utf8');
const appSection = compose.slice(compose.indexOf('  app:'), compose.indexOf('  provisioner:'));
const provisionerSection = compose.slice(
  compose.indexOf('  provisioner:'),
  compose.indexOf('  migrate:')
);
const servicesSection = compose.slice(compose.indexOf('services:'), compose.indexOf('\nnetworks:'));

describe('waste tenant database provisioning deployment', () => {
  it('keeps cluster credentials out of the normal app worker', () => {
    expect(appSection).toContain("SVA_PLUGIN_OPERATION_WORKER_LANE: 'default'");
    expect(appSection).not.toContain('POSTGRES_PASSWORD');
    expect(appSection).not.toContain('WASTE_DATABASE_PROVISIONER');
  });

  it('uses the existing provisioner service and a protected secret for privileged jobs', () => {
    expect(provisionerSection).toContain("SVA_PROVISIONER_COMBINED_WORKER: 'true'");
    expect(provisionerSection).toContain("SVA_PLUGIN_OPERATION_WORKER_LANE: 'privileged'");
    expect(provisionerSection).toContain('/run/secrets/waste_database_provisioner_password');
    expect(provisionerSection).toContain('.output/server/index.mjs');
    expect(servicesSection.match(/^  [a-z][a-z0-9-]+:$/gmu)).toEqual([
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
    expect(entrypoint).not.toContain('WASTE_DATABASE_PROVISIONER_URL="postgresql://${POSTGRES_USER}');
  });
});

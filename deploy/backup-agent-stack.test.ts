import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, 'backup-agent-stack.yaml'), 'utf8');
const dockerfile = readFileSync(resolve(import.meta.dirname, 'backup-agent/Dockerfile'), 'utf8');

describe('backup agent stack', () => {
  it('has one replica, no published ports and all required networks', () => {
    expect(source).not.toMatch(/^\s+ports:/mu);
    expect(source).toContain('replicas: 1');
    expect(source).toContain('      - ingress\n      - staging\n      - production');
    expect(source).toContain('name: network-node-005');
    expect(source).toContain('name: studio-staging_default');
    expect(source).toContain('name: studio_default');
    expect(source).not.toContain('name: portainer_internal');
    expect(source).not.toContain('name: studio-prod_default');
  });

  it('uses central inventory credentials and the existing protected provisioner lane', () => {
    expect(source).toContain('BACKUP_STAGING_POSTGRES_USER: sva');
    expect(source).toContain('BACKUP_PROD_POSTGRES_USER: sva');
    expect(source).toContain('BACKUP_STAGING_POSTGRES_DB: sva_studio');
    expect(source).toContain('source: backup_staging_postgres_password_v3');
    expect(source).toContain('source: backup_prod_postgres_password_v2');
    expect(source).toContain('target: backup_staging_postgres_password');
    expect(source).toContain('BACKUP_PROD_POSTGRES_DB: sva_studio');
    expect(source).toContain('RESTORE_STAGING_POSTGRES_USER: sva_restore');
    expect(source).toContain('RESTORE_PROD_POSTGRES_USER: sva_restore');
    expect(source).toContain(
      'RESTORE_STAGING_POSTGRES_PASSWORD_FILE: /run/secrets/restore_staging_postgres_password'
    );
    expect(source).toContain(
      'RESTORE_PROD_POSTGRES_PASSWORD_FILE: /run/secrets/restore_prod_postgres_password'
    );
    expect(source).toContain('BACKUP_STAGING_WASTE_PROVISIONER_USER: sva_waste_provisioner');
    expect(source).toContain('BACKUP_PROD_WASTE_PROVISIONER_USER: sva_waste_provisioner');
    expect(source).toContain(
      'BACKUP_PROD_WASTE_PROVISIONER_PASSWORD_FILE: /run/secrets/prod_waste_database_provisioner_password'
    );
    expect(source).toContain('source: studio_staging_waste_database_provisioner_password_v1');
    expect(source).toContain('source: studio_waste_database_provisioner_password_v1');
    expect(source).not.toContain('BACKUP_PROD_WASTE_POSTGRES_DB');
    expect(source).not.toContain('RESTORE_PROD_WASTE_POSTGRES_DB');
  });

  it('routes only the exact mutation and read-only capability endpoints on the existing hosts', () => {
    expect(source).toContain(
      '((Path(`/_ops/backup/v1/requests`) || Path(`/_ops/restore/v1/requests`)) && Method(`POST`))'
    );
    expect(source).toContain('backup-agent-rate-limit.ratelimit.average=2');
    expect(source).toContain('Path(`/_ops/backup/v1/capabilities`) && Method(`GET`)');
    expect(source).toContain('traefik.http.routers.backup-agent.priority=1000');
    expect(source).toContain('traefik.http.routers.backup-agent.tls.certresolver=default');
    expect(source).not.toContain('traefik.http.routers.backup-agent-prod.');
    expect(source).not.toContain('traefik.http.routers.backup-agent-staging.');
  });

  it('isolates restore workflow and signing credentials from the backup path', () => {
    expect(source).toContain('RESTORE_AGENT_ALLOWED_WORKFLOWS: database-restore.yml');
    expect(source).toContain(
      'RESTORE_STAGING_SIGNING_KEY_FILE: /run/secrets/restore_staging_signing_key'
    );
    expect(source).toContain(
      'RESTORE_PROD_SIGNING_KEY_FILE: /run/secrets/restore_prod_signing_key'
    );
  });

  it('uses a minimal dedicated image with required backup tools', () => {
    expect(dockerfile).toContain('aws-cli');
    expect(dockerfile).toContain('postgresql18-client');
    expect(dockerfile).not.toContain('sva-studio-react');
    expect(dockerfile).not.toContain('pnpm install');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, 'backup-agent-stack.yaml'), 'utf8');
const dockerfile = readFileSync(resolve(import.meta.dirname, 'backup-agent/Dockerfile'), 'utf8');

describe('backup agent stack', () => {
  it('has one replica, no published ports and all required networks', () => {
    expect(source).not.toMatch(/^\s+ports:/mu);
    expect(source).toContain("replicas: 1");
    expect(source).toContain("      - ingress\n      - staging\n      - production");
    expect(source).toContain('name: network-node-005');
    expect(source).toContain('name: studio-staging_default');
    expect(source).toContain('name: portainer_internal');
    expect(source).not.toContain('name: studio-prod_default');
  });

  it('uses the application database principal from both live Studio stacks', () => {
    expect(source).toContain('BACKUP_STAGING_POSTGRES_USER: sva');
    expect(source).toContain('BACKUP_PROD_POSTGRES_USER: sva');
    expect(source).toContain('BACKUP_STAGING_POSTGRES_DB: sva_studio');
    expect(source).toContain('source: backup_staging_postgres_password_v3');
    expect(source).toContain('source: backup_prod_postgres_password_v2');
    expect(source).toContain('target: backup_staging_postgres_password');
    expect(source).toContain('BACKUP_PROD_POSTGRES_DB: sva_studio');
  });

  it('routes only the exact POST endpoint on the existing hosts', () => {
    expect(source).toContain(
      '(Host(`backup-studio-staging.smart-village.app`) || Host(`backup-studio.smart-village.app`)) && Path(`/_ops/backup/v1/requests`) && Method(`POST`)',
    );
    expect(source).toContain('backup-agent-rate-limit.ratelimit.average=2');
    expect(source).toContain('traefik.http.routers.backup-agent.priority=1000');
    expect(source).toContain('traefik.http.routers.backup-agent.tls.certresolver=default');
    expect(source).not.toContain('traefik.http.routers.backup-agent-prod.');
    expect(source).not.toContain('traefik.http.routers.backup-agent-staging.');
  });

  it('uses a minimal dedicated image with required backup tools', () => {
    expect(dockerfile).toContain('aws-cli');
    expect(dockerfile).toContain('postgresql-client');
    expect(dockerfile).not.toContain('sva-studio-react');
    expect(dockerfile).not.toContain('pnpm install');
  });
});

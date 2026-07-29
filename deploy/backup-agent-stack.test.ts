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
  });

  it('routes only the exact POST endpoint on the existing hosts', () => {
    expect(source).toContain('Host(`studio-staging.smart-village.app`) && Path(`/_ops/backup/v1/requests`) && Method(`POST`)');
    expect(source).toContain('Host(`studio.smart-village.app`) && Path(`/_ops/backup/v1/requests`) && Method(`POST`)');
    expect(source).toContain('backup-agent-rate-limit.ratelimit.average=2');
    expect(source).not.toContain('traefik.http.routers.backup-agent-prod.entrypoints=web,');
  });

  it('uses a minimal dedicated image with required backup tools', () => {
    expect(dockerfile).toContain('aws-cli');
    expect(dockerfile).toContain('postgresql-client');
    expect(dockerfile).not.toContain('sva-studio-react');
    expect(dockerfile).not.toContain('pnpm install');
  });
});

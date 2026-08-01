import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  studioIngressContracts,
  type StudioIngressEnvironment,
} from '../ops/runtime/tenant-ingress-hosts.ts';

const profiles = [
  { composeFile: 'deploy/compose.dev.yaml', environment: 'dev', router: 'studio-dev-app' },
  { composeFile: 'deploy/compose.staging.yaml', environment: 'staging', router: 'studio-staging-app' },
  { composeFile: 'deploy/compose.prod.yaml', environment: 'prod', router: 'studio-prod-app' },
] as const satisfies readonly {
  composeFile: string;
  environment: StudioIngressEnvironment;
  router: string;
}[];

const readLabel = (source: string, labelName: string) => {
  const line = source.split('\n').find((candidate) => candidate.includes(`${labelName}=`));
  if (!line) throw new Error(`Compose-Label ${labelName} fehlt.`);
  return line.slice(line.indexOf(`${labelName}=`) + labelName.length + 1).replace(/["']\s*$/u, '');
};

const parseV1Hosts = (rule: string) => rule.replace(/^Host:/u, '').split(',');
const parseV2Hosts = (rule: string) => [...rule.matchAll(/Host\(`([^`]+)`\)/gu)].map((match) => match[1]);

describe.each(profiles)('$environment tenant ingress compose contract', ({ composeFile, environment, router }) => {
  const source = readFileSync(resolve(process.cwd(), composeFile), 'utf8');
  const contract = studioIngressContracts[environment];

  it('contains the exact deterministic host set in Traefik v1 and v2 labels', () => {
    const v1Hosts = parseV1Hosts(readLabel(source, 'traefik.frontend.rule'));
    const v2Hosts = parseV2Hosts(readLabel(source, `traefik.http.routers.${router}.rule`));

    expect(v1Hosts).toEqual(contract.hosts);
    expect(v2Hosts).toEqual(contract.hosts);
    expect(new Set(v1Hosts).size).toBe(v1Hosts.length);
    expect(new Set(v2Hosts).size).toBe(v2Hosts.length);
    expect(contract.tenantIds).toEqual([...contract.tenantIds].sort());
    expect(contract.tenantIds.every((instanceId) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(instanceId))).toBe(true);
  });

  it('keeps the concrete TLS router contract and excludes wildcard routing', () => {
    expect(source).toContain(`traefik.http.routers.${router}.entrypoints=web,websecure`);
    expect(source).toContain(`traefik.http.routers.${router}.tls=true`);
    expect(source).toContain(`traefik.http.routers.${router}.tls.certresolver=default`);
    expect(source).not.toContain('HostRegexp');
  });
});

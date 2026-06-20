import { describe, expect, it } from 'vitest';

import type { TenantRuntimeTarget } from '../runtime-env.shared.ts';
import { mergeExplicitTenantTargetsWithRegistry, parseTenantRealmOverrides } from './remote-verification.ts';

describe('remote verification helpers', () => {
  it('parses tenant realm overrides from comma-separated env syntax', () => {
    expect(parseTenantRealmOverrides('hb-demo=saas-hb-demo, de-prod = realm-prod, broken')).toEqual(
      new Map([
        ['hb-demo', 'saas-hb-demo'],
        ['de-prod', 'realm-prod'],
      ]),
    );
  });

  it('merges registry realms into explicit tenant targets without changing other fields', () => {
    const explicitTargets: readonly TenantRuntimeTarget[] = [
      {
        authRealm: 'hb-demo',
        host: 'hb-demo.studio.example.org',
        instanceId: 'hb-demo',
      },
      {
        authRealm: 'de-prod',
        host: 'de-prod.studio.example.org',
        instanceId: 'de-prod',
      },
    ];
    const registryTargets: readonly TenantRuntimeTarget[] = [
      {
        authRealm: 'saas-hb-demo',
        host: 'hb-demo.studio.example.org',
        instanceId: 'hb-demo',
      },
    ];

    expect(mergeExplicitTenantTargetsWithRegistry(explicitTargets, registryTargets)).toEqual([
      {
        authRealm: 'saas-hb-demo',
        host: 'hb-demo.studio.example.org',
        instanceId: 'hb-demo',
      },
      {
        authRealm: 'de-prod',
        host: 'de-prod.studio.example.org',
        instanceId: 'de-prod',
      },
    ]);
  });
});

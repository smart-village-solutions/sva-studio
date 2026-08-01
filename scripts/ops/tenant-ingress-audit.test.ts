import { describe, expect, it, vi } from 'vitest';

import { runHttpChecks } from './studio-instance-audit/http-checks.ts';
import { buildRegistryChecks } from './studio-instance-audit/run.ts';

describe('tenant ingress instance audit', () => {
  const target = {
    authClientId: 'sva-studio',
    authClientSecretConfigured: true,
    authRealm: 'bb-guben',
    displayName: 'Guben',
    instanceId: 'bb-guben',
    parentDomain: 'studio.smart-village.app',
    primaryHostname: 'bb-guben.studio.smart-village.app',
    status: 'active',
    tenantAdminClientId: 'bb-guben-admin',
    tenantAdminClientSecretConfigured: true,
  } as const;

  it('separates explicit ingress readiness from active registry status', () => {
    expect(buildRegistryChecks(target).find((check) => check.checkId === 'ingress.host.explicit')).toMatchObject({
      status: 'pass',
    });
    expect(buildRegistryChecks({
      ...target,
      instanceId: 'unknown-active',
      primaryHostname: 'unknown-active.studio.smart-village.app',
    }).find((check) => check.checkId === 'ingress.host.explicit')).toMatchObject({
      status: 'fail',
    });
  });

  it('confirms that the tenant login redirect keeps the requested host', async () => {
    const host = target.primaryHostname;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => String(input).endsWith('/auth/login')
      ? new Response(null, {
          headers: {
            location: `https://keycloak.smart-village.app/realms/bb-guben/protocol/openid-connect/auth?redirect_uri=${encodeURIComponent(`https://${host}/auth/callback`)}`,
          },
          status: 302,
        })
      : new Response(null, { status: 200 })) as typeof fetch;

    const result = await runHttpChecks(target, { fetchImpl });

    expect(result.checks.find((check) => check.checkId === 'reachability.login')).toMatchObject({
      status: 'pass',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  buildAcceptanceIngressConsistencyCheck,
  buildAcceptanceServiceCheck,
  isExpectedOidcRedirect,
  runHttpProbe,
} from './acceptance-runtime-checks.ts';
import { createDeps } from './acceptance-runtime-checks.test-helpers.ts';

describe('acceptance runtime checks', () => {
  it('builds an ok acceptance service check when remote stack evidence is readable', async () => {
    const deps = createDeps();

    const check = await buildAcceptanceServiceCheck(deps, {});

    expect(check).toEqual({
      code: 'remote_services_visible',
      details: {
        channel: 'portainer-api',
        summary: 'app running',
      },
      message: 'Remote-Service-Status konnte abgefragt werden.',
      name: 'acceptance-services',
      status: 'ok',
    });
  });

  it('builds an error ingress consistency check when swarm and live endpoint disagree', async () => {
    const deps = createDeps({
      checkHttpHealth: vi.fn(async () => ({
        payload: undefined,
        response: {
          ok: false,
          status: 503,
        },
      })),
    });

    const check = await buildAcceptanceIngressConsistencyCheck(deps, {
      SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
    });

    expect(check).toEqual({
      code: 'remote_app_ingress_inconsistent',
      details: {
        baseUrl: 'https://studio.smart-village.app',
        channel: 'portainer-api',
        liveStatus: 503,
        stackName: 'studio',
      },
      message: 'Swarm meldet einen laufenden App-Task, aber der externe Live-Endpoint ist nicht gesund.',
      name: 'acceptance-ingress-consistency',
      status: 'error',
    });
  });

  it('accepts expected oidc redirects from configured issuers and fallback realm paths', () => {
    expect(isExpectedOidcRedirect('https://issuer.example.test/protocol/openid-connect/auth', {})).toBe(false);
    expect(
      isExpectedOidcRedirect('https://issuer.example.test/protocol/openid-connect/auth', {
        SVA_AUTH_ISSUER: 'https://issuer.example.test',
      }),
    ).toBe(true);
    expect(
      isExpectedOidcRedirect('https://issuer.example.test/protocol/openid-connect/auth', {
        SVA_AUTH_ISSUER: 'https://issuer.example.test/',
      }),
    ).toBe(true);
    expect(
      isExpectedOidcRedirect('https://keycloak.example.test/realms/studio/protocol/openid-connect/auth', {
        KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.test/',
      }),
    ).toBe(true);
    expect(
      isExpectedOidcRedirect('https://id.example.test/realms/studio/protocol/openid-connect/auth?client_id=web', {}),
    ).toBe(true);
  });

  it('returns payload details when a probe expectation fails', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 503,
      }),
    );

    const result = await runHttpProbe(
      {
        expect: (response) => (response.status === 200 ? null : `Erwartet 200, erhalten ${response.status}.`),
        name: 'public-ready',
        scope: 'external',
        target: 'https://studio.smart-village.app/health/ready',
      },
      { fetchImpl },
    );

    expect(result).toEqual({
      details: {
        payload: { ok: false },
      },
      durationMs: expect.any(Number),
      httpStatus: 503,
      message: 'Erwartet 200, erhalten 503.',
      name: 'public-ready',
      scope: 'external',
      status: 'error',
      target: 'https://studio.smart-village.app/health/ready',
    });
  });
});

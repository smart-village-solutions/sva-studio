import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authenticateSsfRuntimeServiceToken,
  readSsfRuntimeServiceTokenConfig,
} from './ssf-runtime-service-token.js';

const config = {
  enabled: true,
  issuer: 'https://id.example/realms/ssf',
  audience: 'sva-studio-ssf-runtime',
  clientId: 'ssf-runtime',
} as const;

describe('SSF runtime service token authentication', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled by default and requires an explicit issuer', () => {
    expect(readSsfRuntimeServiceTokenConfig({})).toBeNull();
    expect(readSsfRuntimeServiceTokenConfig({ SVA_STUDIO_SSF_RUNTIME_ENABLED: 'true' })).toBeNull();
  });

  it('uses the fixed V1 audience and client defaults', () => {
    expect(
      readSsfRuntimeServiceTokenConfig({
        SVA_STUDIO_SSF_RUNTIME_ENABLED: 'true',
        SVA_STUDIO_SSF_RUNTIME_ISSUER: 'https://id.example/realms/ssf/',
      })
    ).toEqual(config);
  });

  it('accepts the exact client and action without requiring a human platform role', async () => {
    const verifier = vi.fn(async () => ({
      sub: 'service-account-ssf-runtime',
      azp: 'ssf-runtime',
      resource_access: {
        'ssf-runtime': { roles: ['ssf.runtime-configuration.read'] },
      },
    }));

    await expect(authenticateSsfRuntimeServiceToken('token', config, verifier)).resolves.toEqual({
      kind: 'authenticated',
      subject: 'service-account-ssf-runtime',
    });
  });

  it.each([
    [401, 'service_authentication_invalid', { sub: 'service', azp: 'other' }],
    [
      403,
      'service_action_forbidden',
      {
        sub: 'service',
        azp: 'ssf-runtime',
        resource_access: { 'ssf-runtime': { roles: ['other.action'] } },
      },
    ],
  ])('rejects invalid claims with status %s', async (status, code, payload) => {
    const result = await authenticateSsfRuntimeServiceToken('token', config, async () => payload);
    expect(result).toMatchObject({ kind: 'rejected', status, code });
  });

  it('maps JWKS transport errors separately from invalid tokens', async () => {
    const unavailable = await authenticateSsfRuntimeServiceToken('token', config, async () => {
      throw new TypeError('fetch failed');
    });
    const invalid = await authenticateSsfRuntimeServiceToken('token', config, async () => {
      throw new Error('signature invalid');
    });

    expect(unavailable).toMatchObject({
      status: 503,
      code: 'runtime_configuration_unavailable',
    });
    expect(invalid).toMatchObject({ status: 401, code: 'service_authentication_invalid' });
  });
});

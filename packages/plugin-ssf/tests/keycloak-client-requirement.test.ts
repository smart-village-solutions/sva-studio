import { describe, expect, it } from 'vitest';

import { SSF_TENANT_OIDC_CLIENT_REQUIREMENT } from '../src/provisioning.js';

describe('SSF tenant OIDC client requirement', () => {
  it('declares only the stable tenant audience and fail-closed activation state', () => {
    expect(SSF_TENANT_OIDC_CLIENT_REQUIREMENT).toEqual({
      contractVersion: '1.0',
      pluginId: 'ssf',
      clientId: 'ssf',
      audience: 'ssf',
      enabled: false,
    });
    expect(SSF_TENANT_OIDC_CLIENT_REQUIREMENT).not.toHaveProperty('redirectUris');
    expect(SSF_TENANT_OIDC_CLIENT_REQUIREMENT).not.toHaveProperty('clientSecret');
  });
});

it('derives the public login baseline only from an explicit HTTPS installation origin', async () => {
  const { readSsfLoginClientRequirement } = await import('../src/provisioning.js');
  expect(readSsfLoginClientRequirement({})).toBeNull();
  expect(
    readSsfLoginClientRequirement({ SVA_STUDIO_SSF_LOGIN_ORIGIN: 'https://dialog.kassel.de' })
  ).toEqual({
    contractVersion: '2.0',
    pluginId: 'ssf',
    clientId: 'ssf-frontend',
    audience: 'ssf-frontend',
    enabled: false,
    redirectUris: ['https://dialog.kassel.de/login/*'],
    webOrigins: ['https://dialog.kassel.de'],
  });
  for (const origin of [
    'not-a-url',
    'http://dialog.kassel.de',
    'https://*.kassel.de',
    'https://dialog.kassel.de/path',
    'https://user:secret@dialog.kassel.de',
  ]) {
    expect(() => readSsfLoginClientRequirement({ SVA_STUDIO_SSF_LOGIN_ORIGIN: origin })).toThrow(
      'ssf_login_origin_invalid'
    );
  }
});

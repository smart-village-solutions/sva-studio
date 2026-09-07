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

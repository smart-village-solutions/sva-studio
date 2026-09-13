import { describe, expect, it } from 'vitest';

import { resolveProvisioningAuthIssuerUrl } from './kassel-provisioning-auth.js';

const input = {
  parentDomain: 'dialog.kassel.de',
  authRealm: 'smartcity',
};

describe('Kassel provisioning auth issuer', () => {
  it('keeps the existing contract outside Kassel mode', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(
        { ...input, authIssuerUrl: 'https://auth.example.org/realms/demo' },
        { tenantIngressMode: 'external' }
      )
    ).toBe('https://auth.example.org/realms/demo');
  });

  it('derives the public issuer before provisioning in Kassel mode', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(
        { ...input, parentDomain: 'DIALOG.KASSEL.DE.' },
        { tenantIngressMode: 'kassel-traefik-file' }
      )
    ).toBe('https://auth.dialog.kassel.de/realms/smartcity');
  });

  it('uses a validated installation-specific HTTPS auth origin', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(input, {
        tenantIngressMode: 'kassel-traefik-file',
        publicAuthOrigin: 'https://login.dialog.kassel.de',
      })
    ).toBe('https://login.dialog.kassel.de/realms/smartcity');
  });

  it.each([
    'http://auth.dialog.kassel.de',
    'https://user:secret@auth.dialog.kassel.de',
    'https://auth.dialog.kassel.de/keycloak',
    'https://auth.dialog.kassel.de?tenant=demo',
  ])('rejects unsafe public auth origin %s', (publicAuthOrigin) => {
    expect(() =>
      resolveProvisioningAuthIssuerUrl(input, {
        tenantIngressMode: 'kassel-traefik-file',
        publicAuthOrigin,
      })
    ).toThrow('kassel_public_auth_origin_invalid');
  });

  it('rejects Kassel mode for another parent domain', () => {
    expect(() =>
      resolveProvisioningAuthIssuerUrl(
        { ...input, parentDomain: 'studio.smart-village.app' },
        { tenantIngressMode: 'kassel-traefik-file' }
      )
    ).toThrow('kassel_parent_domain_invalid');
  });

  it('rejects a caller-supplied issuer that differs from the installation contract', () => {
    expect(() =>
      resolveProvisioningAuthIssuerUrl(
        { ...input, authIssuerUrl: 'http://ssf-backend-keycloak-1:8080/realms/smartcity' },
        { tenantIngressMode: 'kassel-traefik-file' }
      )
    ).toThrow('kassel_auth_issuer_mismatch');
  });
});

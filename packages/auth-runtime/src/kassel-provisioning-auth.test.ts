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

  it('derives a new realm issuer from the configured Keycloak base URL', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(input, {
        tenantIngressMode: 'external',
        keycloakBaseUrl: 'https://keycloak.example.org/auth/',
      })
    ).toBe('https://keycloak.example.org/auth/realms/smartcity');
  });

  it('removes all trailing slashes before deriving the issuer', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(input, {
        tenantIngressMode: 'external',
        keycloakBaseUrl: 'https://keycloak.example.org///',
      })
    ).toBe('https://keycloak.example.org/realms/smartcity');
  });

  it('fails closed without an issuer source outside Kassel mode', () => {
    expect(() =>
      resolveProvisioningAuthIssuerUrl(input, { tenantIngressMode: 'external' })
    ).toThrow('keycloak_admin_base_url_missing');
  });

  it('supports configured HTTP Keycloak bases outside production', () => {
    expect(
      resolveProvisioningAuthIssuerUrl(input, {
        tenantIngressMode: 'external',
        keycloakBaseUrl: 'http://keycloak:38080',
        nodeEnv: 'development',
      })
    ).toBe('http://keycloak:38080/realms/smartcity');
  });

  it.each(['http://keycloak:38080', 'http://127.0.0.1:38080'])(
    'supports trusted HTTP Keycloak base %s in production',
    (keycloakBaseUrl) => {
      expect(
        resolveProvisioningAuthIssuerUrl(input, {
          tenantIngressMode: 'external',
          keycloakBaseUrl,
          nodeEnv: 'production',
        })
      ).toBe(`${keycloakBaseUrl}/realms/smartcity`);
    }
  );

  it.each(['http://keycloak.example.org:38080', 'http://127.attacker.example:38080'])(
    'rejects public HTTP Keycloak base %s in production',
    (keycloakBaseUrl) => {
      expect(() =>
        resolveProvisioningAuthIssuerUrl(input, {
          tenantIngressMode: 'external',
          keycloakBaseUrl,
          nodeEnv: 'production',
        })
      ).toThrow('keycloak_admin_base_url_invalid');
    }
  );

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

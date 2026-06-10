import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLocalIamCheck,
  createRegistryChecks,
  probeInstanceUrlReachability,
} from './service-audit-registry.js';

describe('service-audit-registry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks reachable instances as pass and 5xx responses as fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch);
    await expect(probeInstanceUrlReachability('demo.example.org')).resolves.toEqual(
      expect.objectContaining({
        status: 'pass',
        actual: 'HTTP 204',
      })
    );

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch);
    await expect(probeInstanceUrlReachability('demo.example.org')).resolves.toEqual(
      expect.objectContaining({
        status: 'fail',
        actual: 'HTTP 503',
      })
    );
  });

  it('reports fetch failures as unreachable instances', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network');
    }) as typeof fetch);

    await expect(probeInstanceUrlReachability('demo.example.org')).resolves.toEqual(
      expect.objectContaining({
        status: 'fail',
        actual: 'TypeError',
      })
    );
  });

  it('fails empty registry fields and missing secrets', () => {
    const checks = createRegistryChecks({
      status: 'requested',
      authRealm: ' ',
      authClientId: '',
      authClientSecretConfigured: false,
      tenantAdminClientId: ' ',
      tenantAdminSecretConfigured: false,
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'registry.instance.active', status: 'fail' }),
        expect.objectContaining({ checkId: 'registry.realm.present', status: 'fail', actual: 'leer' }),
        expect.objectContaining({ checkId: 'registry.loginClient.present', status: 'fail', actual: 'leer' }),
        expect.objectContaining({ checkId: 'registry.tenantAdminClient.present', status: 'fail', actual: 'leer' }),
        expect.objectContaining({
          checkId: 'registry.loginSecret.configured',
          status: 'fail',
          actual: 'nicht konfiguriert',
        }),
        expect.objectContaining({
          checkId: 'registry.tenantAdminSecret.configured',
          status: 'fail',
          actual: 'nicht konfiguriert',
        }),
      ])
    );
  });

  it('passes configured registry fields and local IAM assignments', () => {
    const checks = createRegistryChecks({
      status: 'active',
      authRealm: 'demo',
      authClientId: 'studio-client',
      authClientSecretConfigured: true,
      tenantAdminClientId: 'tenant-admin',
      tenantAdminSecretConfigured: true,
    });

    expect(checks.every((check) => check.status === 'pass')).toBe(true);
    expect(createLocalIamCheck(0)).toEqual(expect.objectContaining({ status: 'fail' }));
    expect(createLocalIamCheck(2)).toEqual(expect.objectContaining({ status: 'pass', actual: '2 aktive Zuordnungen' }));
  });
});

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

  it.each(['127.0.0.1', '[::1]', '100.64.0.1', 'user@demo.example.org', 'demo.example.org/path', 'demo.example.org?next=internal'])(
    'rejects non-public or malformed probe host %s before fetch',
    async (hostname) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(probeInstanceUrlReachability(hostname)).resolves.toMatchObject({ status: 'fail' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('does not follow probe redirects and releases their body', async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); } });
    const response = new Response(body, { status: 302, headers: { location: 'https://127.0.0.1' } });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    await expect(probeInstanceUrlReachability('demo.example.org')).resolves.toMatchObject({ status: 'pass' });
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://demo.example.org'), expect.objectContaining({ redirect: 'manual' }));
    expect(body.locked).toBe(false);
    await expect(response.arrayBuffer()).rejects.toThrow();
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

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getInstanceConfig: vi.fn(),
  isCanonicalAuthHost: vi.fn(),
  loadInstanceByHostname: vi.fn(),
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    createSdkLogger: () => mocks.logger,
    getInstanceConfig: mocks.getInstanceConfig,
    isCanonicalAuthHost: mocks.isCanonicalAuthHost,
  };
});

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceByHostname: mocks.loadInstanceByHostname,
}));

import { resolveAuthRequestHost, sanitizeAuthReturnTo } from './auth-return-to.js';

const request = (headers: HeadersInit = {}, url = 'https://auth.example.test/login') =>
  new Request(url, { headers });

describe('auth return-to handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('keeps safe relative return targets and falls back for unsafe auth paths', async () => {
    await expect(sanitizeAuthReturnTo(request(), '/dashboard')).resolves.toBe('/dashboard');
    await expect(sanitizeAuthReturnTo(request(), '/auth', { defaultPath: '/home' })).resolves.toBe('/home');
    await expect(sanitizeAuthReturnTo(request(), '/auth?next=/dashboard', { defaultPath: '/home' })).resolves.toBe('/home');
    await expect(sanitizeAuthReturnTo(request(), '/auth/callback', { defaultPath: '/home' })).resolves.toBe('/home');
    await expect(sanitizeAuthReturnTo(request(), '//evil.example.test', { defaultPath: '/home' })).resolves.toBe(
      '/home'
    );
    await expect(sanitizeAuthReturnTo(request(), null, { defaultPath: '/home' })).resolves.toBe('/home');
  });

  it('rejects invalid or untrusted absolute return targets', async () => {
    mocks.getInstanceConfig.mockReturnValue(null);

    await expect(sanitizeAuthReturnTo(request(), 'javascript:alert(1)', { defaultPath: '/' })).resolves.toBe('/');
    await expect(sanitizeAuthReturnTo(request(), 'https://tenant.example.test/dashboard', { defaultPath: '/' })).resolves.toBe(
      '/'
    );
  });

  it('allows canonical auth hosts and active tenant hosts', async () => {
    mocks.getInstanceConfig.mockReturnValue({
      parentDomain: 'example.test',
      canonicalAuthHost: 'auth.example.test',
    });
    mocks.isCanonicalAuthHost.mockImplementation((host: string) => host === 'auth.example.test');
    mocks.loadInstanceByHostname.mockResolvedValue({
      instanceId: 'tenant-a',
      status: 'active',
    });

    await expect(
      sanitizeAuthReturnTo(request(), 'https://auth.example.test/account', { defaultPath: '/' })
    ).resolves.toBe('https://auth.example.test/account');
    await expect(
      sanitizeAuthReturnTo(request(), 'https://auth.example.test/auth', { defaultPath: '/home' })
    ).resolves.toBe('/home');
    await expect(
      sanitizeAuthReturnTo(request(), 'https://auth.example.test/auth?next=/dashboard', { defaultPath: '/home' })
    ).resolves.toBe('/home');
    await expect(
      sanitizeAuthReturnTo(request(), 'https://tenant.example.test/dashboard', { defaultPath: '/' })
    ).resolves.toBe('https://tenant.example.test/dashboard');
    await expect(
      sanitizeAuthReturnTo(request(), 'http://tenant.example.test/dashboard', { defaultPath: '/' })
    ).resolves.toBe('/');
  });

  it('normalizes hostnames without ports for trust checks', async () => {
    mocks.getInstanceConfig.mockReturnValue({
      parentDomain: 'example.test',
      canonicalAuthHost: 'auth.example.test',
    });
    mocks.isCanonicalAuthHost.mockImplementation((host: string) => host === 'auth.example.test');
    mocks.loadInstanceByHostname.mockResolvedValue({
      instanceId: 'tenant-a',
      status: 'active',
    });

    await expect(
      sanitizeAuthReturnTo(request(), 'https://tenant.example.test:8443/dashboard', { defaultPath: '/' })
    ).resolves.toBe('https://tenant.example.test:8443/dashboard');
    expect(mocks.loadInstanceByHostname).toHaveBeenCalledWith('tenant.example.test');
  });

  it('allows canonical auth hosts with ports after hostname normalization', async () => {
    mocks.getInstanceConfig.mockReturnValue({
      parentDomain: 'example.test',
      canonicalAuthHost: 'auth.example.test',
    });
    mocks.isCanonicalAuthHost.mockImplementation((host: string) => host === 'auth.example.test');

    await expect(
      sanitizeAuthReturnTo(request(), 'https://auth.example.test:9443/account', { defaultPath: '/' })
    ).resolves.toBe('https://auth.example.test:9443/account');
    expect(mocks.isCanonicalAuthHost).toHaveBeenCalledWith('auth.example.test');
  });

  it('falls back and logs when tenant registry validation fails for an absolute return target', async () => {
    mocks.getInstanceConfig.mockReturnValue({
      parentDomain: 'example.test',
      canonicalAuthHost: 'auth.example.test',
    });
    mocks.isCanonicalAuthHost.mockReturnValue(false);
    mocks.loadInstanceByHostname.mockRejectedValueOnce(new Error('db down'));

    await expect(
      sanitizeAuthReturnTo(request(), 'https://tenant.example.test/dashboard', { defaultPath: '/home' })
    ).resolves.toBe('/home');

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Tenant absolute return target validation failed',
      expect.objectContaining({
        hostname: 'tenant.example.test',
        reason_code: 'tenant_return_to_lookup_failed',
        error_type: 'Error',
      })
    );
  });

  it('falls back and logs when the absolute return target is not a valid URL', async () => {
    await expect(sanitizeAuthReturnTo(request(), 'https://tenant example.test/dashboard', { defaultPath: '/home' })).resolves.toBe(
      '/home'
    );

    expect(mocks.logger.debug).toHaveBeenCalledWith(
      'Absolute return target URL is invalid',
      expect.objectContaining({
        reason_code: 'invalid_return_to_url',
      })
    );
  });

  it('resolves the effective request host through the shared host parser', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(resolveAuthRequestHost(request({ 'x-forwarded-host': 'Tenant.Example.Test' }))).toBe(
      'tenant.example.test'
    );
  });
});

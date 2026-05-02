import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/logger/index.server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('instance config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when SVA_PARENT_DOMAIN is not set', async () => {
    delete process.env.SVA_PARENT_DOMAIN;
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { getInstanceConfig } = await import('../../src/instance/config.server');

    expect(getInstanceConfig()).toBeNull();
  }, 10_000);

  it('loads a normalized config for valid values', async () => {
    process.env.SVA_PARENT_DOMAIN = 'Studio.Example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo,bar';

    const { getInstanceConfig } = await import('../../src/instance/config.server');
    const config = getInstanceConfig();

    expect(config).not.toBeNull();
    expect(config?.parentDomain).toBe('studio.example.org');
    expect(config?.canonicalAuthHost).toBe('studio.example.org');
    expect(Array.from(config?.allowedInstanceIds ?? [])).toEqual(['foo', 'bar']);
  });

  it('throws on punycode values in the allowlist', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'xn--demo';

    const { getInstanceConfig } = await import('../../src/instance/config.server');

    expect(() => getInstanceConfig()).toThrow(/xn--/);
  });

  it('throws on invalid allowlist values', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = '-invalid';

    const { getInstanceConfig } = await import('../../src/instance/config.server');

    expect(() => getInstanceConfig()).toThrow(/Erlaubtes Muster/);
  });

  it('caches config until reset is called', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const module = await import('../../src/instance/config.server');

    expect(module.getInstanceConfig()?.allowedInstanceIds.has('foo')).toBe(true);

    process.env.SVA_ALLOWED_INSTANCE_IDS = 'bar';
    expect(module.getInstanceConfig()?.allowedInstanceIds.has('foo')).toBe(true);

    module.resetInstanceConfigCache();
    expect(module.getInstanceConfig()?.allowedInstanceIds.has('bar')).toBe(true);
  });

  it('returns the instance id for a valid subdomain host', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('foo.studio.example.org')).toBe('foo');
  });

  it('normalizes host casing, trailing dots and ports', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('FOO.Studio.Example.org.:3000')).toBe('foo');
  });

  it('rejects the root domain', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('studio.example.org')).toBeNull();
  });

  it('rejects hosts outside the parent domain', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('foo.other.example.org')).toBeNull();
  });

  it('rejects multi-level subdomains', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('bar.foo.studio.example.org')).toBeNull();
  });

  it('rejects punycode hosts', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('xn--demo.studio.example.org')).toBeNull();
  });

  it('rejects hosts that are not in the allowlist', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('bar.studio.example.org')).toBeNull();
  });

  it('returns null for parseInstanceIdFromHost without config', async () => {
    delete process.env.SVA_PARENT_DOMAIN;
    delete process.env.SVA_ALLOWED_INSTANCE_IDS;

    const { parseInstanceIdFromHost } = await import('../../src/instance/config.server');

    expect(parseInstanceIdFromHost('foo.studio.example.org')).toBeNull();
  });

  it('identifies the canonical auth host', async () => {
    process.env.SVA_PARENT_DOMAIN = 'studio.example.org';
    process.env.SVA_ALLOWED_INSTANCE_IDS = 'foo';

    const { isCanonicalAuthHost } = await import('../../src/instance/config.server');

    expect(isCanonicalAuthHost('studio.example.org')).toBe(true);
    expect(isCanonicalAuthHost('Studio.Example.org.:443')).toBe(true);
    expect(isCanonicalAuthHost('foo.studio.example.org')).toBe(false);
  });

  it('treats every host as canonical when no config is set', async () => {
    delete process.env.SVA_PARENT_DOMAIN;

    const { isCanonicalAuthHost } = await import('../../src/instance/config.server');

    expect(isCanonicalAuthHost('any.host')).toBe(true);
  });
});

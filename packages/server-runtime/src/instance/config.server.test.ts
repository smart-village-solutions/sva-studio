import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getInstanceConfig,
  isCanonicalAuthHost,
  parseInstanceIdFromHost,
  resetInstanceConfigCache,
} from './config.server.js';

describe('instance config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstanceConfigCache();
  });

  it('returns null defaults when multi-host mode is disabled', () => {
    vi.stubEnv('SVA_PARENT_DOMAIN', '');
    vi.stubEnv('SVA_ALLOWED_INSTANCE_IDS', '');

    expect(getInstanceConfig()).toBeNull();
    expect(parseInstanceIdFromHost('tenant.example.test')).toBeNull();
    expect(isCanonicalAuthHost('anything.test')).toBe(true);
  });

  it('loads allowed tenants and parses tenant hosts', () => {
    vi.stubEnv('SVA_PARENT_DOMAIN', 'Example.Test');
    vi.stubEnv('SVA_ALLOWED_INSTANCE_IDS', 'alpha,beta');

    expect(getInstanceConfig()).toMatchObject({
      parentDomain: 'example.test',
      canonicalAuthHost: 'example.test',
    });
    expect(parseInstanceIdFromHost('alpha.example.test')).toBe('alpha');
    expect(parseInstanceIdFromHost('beta.example.test:443')).toBe('beta');
    expect(parseInstanceIdFromHost('gamma.example.test')).toBeNull();
    expect(parseInstanceIdFromHost('example.test')).toBeNull();
    expect(isCanonicalAuthHost('Example.Test:443')).toBe(true);
    expect(isCanonicalAuthHost('alpha.example.test')).toBe(false);
  });

  it('fails fast for invalid allowlist entries and can reset the cache', () => {
    vi.stubEnv('SVA_PARENT_DOMAIN', 'example.test');
    vi.stubEnv('SVA_ALLOWED_INSTANCE_IDS', 'valid,Tenant');

    expect(() => getInstanceConfig()).toThrow('[InstanceConfig] Ungültige instanceId "Tenant"');

    vi.stubEnv('SVA_ALLOWED_INSTANCE_IDS', 'valid');
    resetInstanceConfigCache();

    expect(parseInstanceIdFromHost('valid.example.test')).toBe('valid');
  });
});

import { describe, expect, it, vi } from 'vitest';

import { createSsfRuntimeConfigurationHandler } from '../src/runtime.js';

const authorizationRevision = `sha256:${'a'.repeat(64)}`;

describe('SSF runtime configuration handler', () => {
  it('reads fresh overrides on every call and preserves the verified authorization revision', async () => {
    const readOverrides = vi
      .fn()
      .mockResolvedValueOnce({
        serverSettings: null,
        serverLocales: [],
        tenantSettings: null,
        tenantLocales: [],
      })
      .mockResolvedValueOnce({
        serverSettings: null,
        serverLocales: [],
        tenantSettings: null,
        tenantLocales: [
          {
            locale: 'de-DE',
            authenticatedHomeExplanationHtml: '<p>Geändert</p>',
          },
        ],
      });
    const handler = createSsfRuntimeConfigurationHandler({
      readOverrides,
      mediaResolver: {
        resolve: async () => {
          throw new Error('No media reference expected.');
        },
      },
    });
    const input = {
      tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'Europe/Berlin' },
      authorizationRevision,
    };

    const first = await handler(input);
    const second = await handler(input);

    expect(readOverrides).toHaveBeenCalledTimes(2);
    expect(first.authorizationRevision).toBe(authorizationRevision);
    expect(second.authorizationRevision).toBe(authorizationRevision);
    expect(second.configurationRevision).not.toBe(first.configurationRevision);
  });

  it('fails before reading configuration when authorization readiness has no valid revision', async () => {
    const readOverrides = vi.fn();
    const handler = createSsfRuntimeConfigurationHandler({
      readOverrides,
      mediaResolver: {
        resolve: async () => ({ url: 'https://example.org/a.png', alternativeText: '' }),
      },
    });

    await expect(
      handler({
        tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'UTC' },
        authorizationRevision: 'not-ready',
      })
    ).rejects.toThrow('authorization revision is invalid');
    expect(readOverrides).not.toHaveBeenCalled();
  });

  it('does not return a previously successful configuration after the database becomes unavailable', async () => {
    const readOverrides = vi
      .fn()
      .mockResolvedValueOnce({
        serverSettings: null,
        serverLocales: [],
        tenantSettings: null,
        tenantLocales: [],
      })
      .mockRejectedValueOnce(new Error('database_unavailable'));
    const handler = createSsfRuntimeConfigurationHandler({
      readOverrides,
      mediaResolver: {
        resolve: async () => {
          throw new Error('No media reference expected.');
        },
      },
    });
    const input = {
      tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'Europe/Berlin' },
      authorizationRevision,
    };

    await expect(handler(input)).resolves.toMatchObject({ contractVersion: '1.0' });
    await expect(handler(input)).rejects.toThrow('database_unavailable');
    expect(readOverrides).toHaveBeenCalledTimes(2);
  });
});

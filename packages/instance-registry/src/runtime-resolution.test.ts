import { describe, expect, it, vi } from 'vitest';

import { isInstanceTrafficAllowed, resolveRuntimeInstanceFromRequest } from './runtime-resolution';

describe('runtime-resolution', () => {
  it('resolves runtime instances through the registry service using the effective request host', async () => {
    const resolveRuntimeInstance = vi.fn(async (host: string) => ({
      hostClassification: {
        kind: 'tenant',
        host,
        normalizedHost: host,
        instanceId: 'bb-guben',
      },
      instance: {
        id: 'bb-guben',
        displayName: 'Guben',
        primaryHostname: 'bb-guben.example.org',
        status: 'active',
      },
    }));
    const result = await resolveRuntimeInstanceFromRequest(new Request('https://ignored.example.org/'), {
      resolveEffectiveRequestHost: () => 'bb-guben.example.org',
      withRegistryService: async (work) =>
        work({
          resolveRuntimeInstance,
        } as never),
    });

    expect(resolveRuntimeInstance).toHaveBeenCalledWith('bb-guben.example.org');
    expect(result.instance?.id).toBe('bb-guben');
  });

  it('keeps traffic status evaluation in the registry package', () => {
    expect(isInstanceTrafficAllowed('active')).toBe(true);
    expect(isInstanceTrafficAllowed('suspended')).toBe(false);
  });
});

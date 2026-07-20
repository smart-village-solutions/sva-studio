import { describe, expect, it, vi } from 'vitest';
import type { StudioApiClient } from './api-client.js';
import type { McpError } from './contracts.js';
import { diagnoseInstance } from './diagnostics.js';

const error = (category: McpError['category']): McpError => ({
  version: '1', code: category === 'internal' ? 'internal_unclassified' : 'test', category,
  retryable: false, summary: 'test', recommendedAction: 'inspect',
});

describe('create failure diagnostics', () => {
  it.each(['validation', 'authentication', 'authorization', 'internal'] as const)('does not call dependencies for %s', async (category) => {
    const request = vi.fn();
    await diagnoseInstance({ request }, 'demo', 1_000, error(category));
    expect(request).not.toHaveBeenCalled();
  });

  it('only reads the instance after a conflict', async () => {
    const request = vi.fn().mockResolvedValue({ data: { instanceId: 'demo' } });
    await diagnoseInstance({ request } as StudioApiClient, 'demo', 1_000, error('conflict'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0].path).toBe('/api/v1/iam/instances/demo');
  });

  it('only reads readiness for platform failures', async () => {
    const request = vi.fn().mockResolvedValue({ status: 'ready' });
    await diagnoseInstance({ request } as StudioApiClient, 'demo', 1_000, error('platform_readiness'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0].path).toBe('/api/v1/iam/health/ready');
  });

  it('checks Keycloak only after an existing instance was found', async () => {
    const request = vi.fn().mockResolvedValue({ data: {} });
    await diagnoseInstance({ request } as StudioApiClient, 'demo', 1_000, error('dependency'));
    expect(request.mock.calls.map((call) => call[0].path)).toEqual([
      '/api/v1/iam/instances/demo',
      '/api/v1/iam/instances/demo/keycloak/status',
      '/api/v1/iam/instances/demo/keycloak/preflight',
    ]);
  });
});

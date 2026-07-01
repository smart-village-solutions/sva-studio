import { describe, expect, it, vi } from 'vitest';

import type { AcceptanceMaintenanceDeps } from './acceptance-maintenance.types.ts';
import { resolveRemoteInternalNetworkName } from './acceptance-maintenance-remote.ts';

const createDeps = (inspectRemoteServiceContract: AcceptanceMaintenanceDeps['inspectRemoteServiceContract']) =>
  ({
    getConfiguredQuantumEndpoint: vi.fn(() => 'https://quantum.example.test'),
    getConfiguredStackName: vi.fn(() => 'studio'),
    getRemoteAppServiceName: vi.fn(() => 'studio-app'),
    inspectRemoteServiceContract,
  }) as unknown as AcceptanceMaintenanceDeps;

describe('acceptance-maintenance-remote', () => {
  it('prefers non-public overlay networks and ignores ingress-style network names', async () => {
    const deps = createDeps(
      vi
        .fn()
        .mockResolvedValueOnce({
          networkNames: ['public', 'network-node-005', 'internal'],
        }),
    );

    await expect(resolveRemoteInternalNetworkName(deps, {})).resolves.toBe('internal');
  });

  it('falls back to the app service when postgres has no usable internal network', async () => {
    const deps = createDeps(
      vi
        .fn()
        .mockResolvedValueOnce({
          networkNames: ['public', 'network-node-005'],
        })
        .mockResolvedValueOnce({
          networkNames: ['public', 'internal'],
        }),
    );

    await expect(resolveRemoteInternalNetworkName(deps, {})).resolves.toBe('internal');
  });
});

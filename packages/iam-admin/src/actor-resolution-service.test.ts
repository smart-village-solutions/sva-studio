import { describe, expect, it, vi } from 'vitest';

import { createActorResolutionServices } from './actor-resolution-service.js';
import type { QueryClient } from './query-client.js';

const createDeps = () => {
  const client: QueryClient = {
    query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
  };

  return {
    client,
    deps: {
      withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
        work(client)
      ),
      resolveActorAccountId: vi.fn(async () => undefined as string | undefined),
      jitProvisionAccountWithClient: vi.fn(async () => ({ accountId: 'provisioned-account-1' })),
      resolveMissingActorDiagnosticReason: vi.fn(async () => 'missing_instance_membership' as const),
    },
  };
};

describe('actor-resolution-service', () => {
  it('returns the existing actor account without provisioning', async () => {
    const { deps } = createDeps();
    deps.resolveActorAccountId.mockResolvedValueOnce('account-1');
    const services = createActorResolutionServices(deps);

    await expect(
      services.resolveActorAccountIdWithProvision({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-1',
        mayProvisionMissingActorMembership: true,
      })
    ).resolves.toBe('account-1');

    expect(deps.jitProvisionAccountWithClient).not.toHaveBeenCalled();
  });

  it('provisions a missing actor account when explicitly allowed', async () => {
    const { deps } = createDeps();
    const services = createActorResolutionServices(deps);

    await expect(
      services.resolveActorAccountIdWithProvision({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-1',
        requestId: 'req-1',
        traceId: 'trace-1',
        mayProvisionMissingActorMembership: true,
      })
    ).resolves.toBe('provisioned-account-1');

    expect(deps.jitProvisionAccountWithClient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      })
    );
  });

  it('does not provision a missing actor account unless provisioning is allowed', async () => {
    const { deps } = createDeps();
    const services = createActorResolutionServices(deps);

    await expect(
      services.resolveActorAccountIdWithProvision({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-1',
        mayProvisionMissingActorMembership: false,
      })
    ).resolves.toBeUndefined();

    expect(deps.jitProvisionAccountWithClient).not.toHaveBeenCalled();
  });

  it('falls back to a generic diagnostic reason when the diagnostic query fails', async () => {
    const { deps } = createDeps();
    deps.resolveMissingActorDiagnosticReason.mockRejectedValueOnce(new Error('db down'));
    const services = createActorResolutionServices(deps);

    await expect(
      services.resolveMissingActorDiagnosticReason('de-musterhausen', 'kc-1')
    ).resolves.toBe('missing_actor_account');
  });
});

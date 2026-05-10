import { describe, expect, it, vi } from 'vitest';

import { createProbeTenantIamAccessHandler } from './service-probe.js';

describe('service-probe', () => {
  it('returns null when the target instance does not exist', async () => {
    const handler = createProbeTenantIamAccessHandler({
      repository: {
        getInstanceById: vi.fn(async () => null),
      },
    } as never);

    await expect(
      handler({
        instanceId: 'missing',
        actorId: 'actor-1',
        requestId: 'req-1',
      })
    ).resolves.toBeNull();
  });

  it('throws when the probe dependency is missing', async () => {
    const handler = createProbeTenantIamAccessHandler({
      repository: {
        getInstanceById: vi.fn(async () => ({ instanceId: 'tenant-a' })),
      },
    } as never);

    await expect(
      handler({
        instanceId: 'tenant-a',
        actorId: 'actor-1',
        requestId: 'req-1',
      })
    ).rejects.toThrow('dependency_missing_probeTenantIamAccess');
  });

  it('probes tenant IAM access, appends audit evidence and merges reconcile status', async () => {
    const repository = {
      getInstanceById: vi.fn(async () => ({ instanceId: 'tenant-a' })),
      appendAuditEvent: vi.fn(async () => undefined),
      getRoleReconcileSummary: vi.fn(async () => ({
        status: 'ready',
        summary: 'roles aligned',
        checkedAt: '2026-05-10T10:00:00.000Z',
        errorCode: undefined,
        requestId: 'req-reconcile',
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
    };
    const probeTenantIamAccess = vi.fn(async () => ({
      status: 'ready',
      summary: 'access ok',
      checkedAt: '2026-05-10T10:00:00.000Z',
      errorCode: undefined,
      requestId: 'req-probe',
    }));
    const handler = createProbeTenantIamAccessHandler({
      repository,
      probeTenantIamAccess,
      getKeycloakStatus: vi.fn(async () => ({
        status: 'ready',
        summary: 'keycloak ok',
        checkedAt: '2026-05-10T10:00:00.000Z',
      })),
    } as never);

    const result = await handler({
      instanceId: 'tenant-a',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    expect(probeTenantIamAccess).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      actorId: 'actor-1',
      requestId: 'req-1',
    });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'tenant_iam_access_probed',
      })
    );
    expect(result).toMatchObject({
      access: expect.objectContaining({
        status: 'ready',
      }),
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveInstanceId: vi.fn(),
  withInstanceDb: vi.fn(),
  loggerInfo: vi.fn(),
  workspaceContext: {
    requestId: 'req-jit',
    traceId: 'trace-jit',
  },
}));

vi.mock('./shared/instance-id-resolution', () => ({
  resolveInstanceId: (input: unknown) => state.resolveInstanceId(input),
}));

vi.mock('./shared/db-helpers', () => ({
  createPoolResolver: () => () => ({ connect: vi.fn() }),
  withInstanceDb: (...args: unknown[]) => state.withInstanceDb(...args),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: state.loggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => state.workspaceContext,
}));

describe('jitProvisionAccount wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips when required input is missing', async () => {
    const { jitProvisionAccount } = await import('./jit-provisioning.server');

    await expect(jitProvisionAccount({ instanceId: undefined, keycloakSubject: 'kc-1' })).resolves.toEqual({
      skipped: true,
      reason: 'missing_instance',
    });

    await expect(jitProvisionAccount({ instanceId: 'instance-1', keycloakSubject: undefined })).resolves.toEqual({
      skipped: true,
      reason: 'missing_subject',
    });
  });

  it('maps resolveInstanceId failures to skip reasons', async () => {
    const { jitProvisionAccount } = await import('./jit-provisioning.server');

    state.resolveInstanceId.mockResolvedValueOnce({ ok: false, reason: 'database_unavailable' });
    await expect(jitProvisionAccount({ instanceId: 'instance-key', keycloakSubject: 'kc-1' })).resolves.toEqual({
      skipped: true,
      reason: 'missing_database',
    });

    state.resolveInstanceId.mockResolvedValueOnce({ ok: false, reason: 'missing_instance' });
    await expect(jitProvisionAccount({ instanceId: 'instance-key', keycloakSubject: 'kc-1' })).resolves.toEqual({
      skipped: true,
      reason: 'missing_instance',
    });

    state.resolveInstanceId.mockResolvedValueOnce({ ok: false, reason: 'invalid_instance' });
    await expect(jitProvisionAccount({ instanceId: 'instance-key', keycloakSubject: 'kc-1' })).resolves.toEqual({
      skipped: true,
      reason: 'invalid_instance',
    });
  });

  it('executes provisioning in resolved instance scope and logs result', async () => {
    state.resolveInstanceId.mockResolvedValue({
      ok: true,
      instanceId: 'de-musterhausen',
      created: true,
    });

    state.withInstanceDb.mockImplementation(
      async (
        _resolvePool: unknown,
        _instanceId: string,
        work: (client: { query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>
      ) => {
        const firstCall = { rows: [{ id: 'acc-1', created: true }] };
        const otherCall = { rows: [] };
        const client = {
          query: vi
            .fn()
            .mockResolvedValueOnce(firstCall)
            .mockResolvedValueOnce(otherCall)
            .mockResolvedValueOnce(otherCall),
        };

        return work(client as unknown as never);
      }
    );

    const { jitProvisionAccount } = await import('./jit-provisioning.server');
    const result = await jitProvisionAccount({
      instanceId: 'instance-key',
      keycloakSubject: 'kc-2',
    });

    expect(result).toEqual({
      skipped: false,
      accountId: 'acc-1',
      created: true,
    });
    expect(state.loggerInfo).toHaveBeenCalledWith(
      'JIT provisioning processed',
      expect.objectContaining({
        operation: 'jit_provision',
        keycloak_subject: 'kc-2',
        request_id: 'req-jit',
        trace_id: 'trace-jit',
      })
    );
  });
});

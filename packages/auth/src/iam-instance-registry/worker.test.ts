import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  processNextQueuedKeycloakProvisioningRun: vi.fn(async () => null),
  withRegistryProvisioningWorkerDeps: vi.fn(async (work: (deps: unknown) => unknown) => work({})),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./service-keycloak-execution.js', () => ({
  processNextQueuedKeycloakProvisioningRun: (...args: unknown[]) => state.processNextQueuedKeycloakProvisioningRun(...args),
}));

vi.mock('./repository.js', () => ({
  withRegistryProvisioningWorkerDeps: (...args: unknown[]) => state.withRegistryProvisioningWorkerDeps(...args),
}));

import {
  isWorkerEntrypoint,
  runKeycloakProvisioningWorkerIteration,
  runKeycloakProvisioningWorkerLoop,
} from './worker.js';

describe('isWorkerEntrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('accepts relative argv entry paths', () => {
    const argvEntry = 'node_modules/@sva/auth/dist/iam-instance-registry/worker.js';
    const moduleUrl = pathToFileURL(resolve(argvEntry)).href;

    expect(isWorkerEntrypoint(moduleUrl, argvEntry)).toBe(true);
  });

  it('returns false without argv entry', () => {
    expect(isWorkerEntrypoint('file:///app/worker.js')).toBe(false);
  });

  it('runKeycloakProvisioningWorkerIteration delegates to worker deps wrapper', async () => {
    state.processNextQueuedKeycloakProvisioningRun.mockResolvedValueOnce({ id: 'run-1' });

    const result = await runKeycloakProvisioningWorkerIteration();

    expect(result).toEqual({ id: 'run-1' });
    expect(state.withRegistryProvisioningWorkerDeps).toHaveBeenCalledTimes(1);
    expect(state.processNextQueuedKeycloakProvisioningRun).toHaveBeenCalledTimes(1);
  });

  it('runKeycloakProvisioningWorkerLoop shuts down gracefully on SIGTERM', async () => {
    vi.useFakeTimers();

    state.processNextQueuedKeycloakProvisioningRun
      .mockResolvedValueOnce({ id: 'run-1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const loopPromise = runKeycloakProvisioningWorkerLoop({ pollIntervalMs: 5 });

    await vi.advanceTimersByTimeAsync(1);
    process.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(20);
    await loopPromise;

    expect(state.logger.info).toHaveBeenCalledWith(
      'keycloak_provisioner_worker_shutdown_requested',
      expect.objectContaining({ operation: 'keycloak_provisioner_worker_loop' })
    );
    expect(state.logger.info).toHaveBeenCalledWith(
      'keycloak_provisioner_worker_shutdown_completed',
      expect.objectContaining({ operation: 'keycloak_provisioner_worker_loop' })
    );
  });

  it('runKeycloakProvisioningWorkerLoop logs iteration failures and continues polling', async () => {
    vi.useFakeTimers();

    state.processNextQueuedKeycloakProvisioningRun
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        process.emit('SIGINT');
        return null;
      });

    const loopPromise = runKeycloakProvisioningWorkerLoop({ pollIntervalMs: 5 });
    await vi.advanceTimersByTimeAsync(30);
    await loopPromise;

    expect(state.logger.error).toHaveBeenCalledWith(
      'keycloak_provisioner_worker_iteration_failed',
      expect.objectContaining({
        operation: 'keycloak_provisioner_worker_loop',
        error: 'boom',
      })
    );
  });
});

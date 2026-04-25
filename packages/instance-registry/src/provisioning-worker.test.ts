import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

import { isWorkerEntrypoint, runKeycloakProvisioningWorkerLoop } from './provisioning-worker.js';

describe('provisioning-worker', () => {
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

  it('shuts down gracefully on SIGTERM', async () => {
    vi.useFakeTimers();

    const runIteration = vi.fn().mockResolvedValueOnce({ id: 'run-1' }).mockResolvedValue(null);
    const loopPromise = runKeycloakProvisioningWorkerLoop(runIteration, { pollIntervalMs: 5 });

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

  it('logs iteration failures and continues polling', async () => {
    vi.useFakeTimers();

    const runIteration = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        process.emit('SIGINT');
        return null;
      });

    const loopPromise = runKeycloakProvisioningWorkerLoop(runIteration, { pollIntervalMs: 5 });
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

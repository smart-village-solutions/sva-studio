import { describe, expect, it, vi } from 'vitest';

import {
  adaptPluginOperationExecutionHandler,
  toRegistryKey,
  toStudioJobTaskList,
} from './runner-internal.js';

describe('plugin operation runner internals', () => {
  it('requires pluginId before adapting plugin handlers and normalizes undefined results to empty objects', async () => {
    const handler = vi.fn(async () => undefined);
    const adapted = adaptPluginOperationExecutionHandler(handler);

    await expect(
      adapted({
        kind: 'job',
        instanceId: 'tenant-a',
        job: { id: 'job-1' },
      } as never)
    ).rejects.toThrow('plugin_job_missing_plugin_id');

    await expect(
      adapted({
        kind: 'job',
        instanceId: 'tenant-a',
        pluginId: 'waste',
        job: { id: 'job-2', inputPayload: {} },
      } as never)
    ).resolves.toEqual({});
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'waste' }));
  });

  it('exposes validated tenant lifecycle metadata to plugin handlers', async () => {
    const handler = vi.fn(async () => undefined);
    const adapted = adaptPluginOperationExecutionHandler(handler, () => true);

    await adapted({
      kind: 'job',
      instanceId: 'tenant-a',
      pluginId: 'waste-management',
      job: {
        id: 'job-3',
        inputPayload: {
          studioTenantLifecycle: { operation: 'reconcile', generation: 4 },
        },
      },
    } as never);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantLifecycle: { operation: 'reconcile', generation: 4 },
      })
    );
  });

  it('ignores reserved lifecycle metadata on generic plugin jobs', async () => {
    const handler = vi.fn(async () => undefined);
    const adapted = adaptPluginOperationExecutionHandler(handler, () => false);

    await expect(
      adapted({
        kind: 'job',
        instanceId: 'tenant-a',
        pluginId: 'waste-management',
        job: {
          id: 'job-4',
          inputPayload: { studioTenantLifecycle: 'application-owned-value' },
        },
      } as never)
    ).resolves.toEqual({});
    expect(handler).toHaveBeenCalledWith(
      expect.not.objectContaining({ tenantLifecycle: expect.anything() })
    );
  });

  it('builds stable registry keys and task-list objects', async () => {
    const task = vi.fn();
    expect(toRegistryKey('plugin', 'waste.import')).toBe('plugin:waste.import');
    expect(toStudioJobTaskList(task)).toEqual({
      studio_job_execute: task,
    });
  });
});

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
        job: { id: 'job-2' },
      } as never)
    ).resolves.toEqual({});
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'waste' }));
  });

  it('builds stable registry keys and task-list objects', async () => {
    const task = vi.fn();
    expect(toRegistryKey('plugin', 'waste.import')).toBe('plugin:waste.import');
    expect(toStudioJobTaskList(task)).toEqual({
      studio_job_execute: task,
    });
  });
});

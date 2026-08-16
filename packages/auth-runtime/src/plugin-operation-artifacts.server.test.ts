import { describe, expect, it, vi } from 'vitest';

import {
  readPluginOperationInput,
  storePluginOperationInput,
} from './plugin-operation-artifacts.server.js';

describe('plugin operation input storage', () => {
  it('stores bytes under an instance-scoped key and resolves only opaque UUID references', async () => {
    const writeObject = vi.fn(async () => ({ etag: 'etag' }));
    const readObject = vi.fn(async () => ({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/zip',
    }));
    const storagePort = { writeObject, readObject } as never;

    const blobRef = await storePluginOperationInput({
      instanceId: 'tenant-a',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/zip',
    }, storagePort);

    expect(blobRef).toMatch(/^plugin-operation-input:[0-9a-f-]{36}$/);
    expect(writeObject).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'tenant-a',
      storageKey: expect.stringMatching(/^tenant-a\/plugin-operation-inputs\/[0-9a-f-]{36}$/),
      body: new Uint8Array([1, 2, 3]),
    }));
    await expect(readPluginOperationInput({ instanceId: 'tenant-a', blobRef }, storagePort))
      .resolves.toEqual({ body: new Uint8Array([1, 2, 3]), contentType: 'application/zip' });
    expect(readObject).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'tenant-a',
      storageKey: expect.stringMatching(/^tenant-a\/plugin-operation-inputs\/[0-9a-f-]{36}$/),
    }));
  });

  it('rejects malformed input references before reading storage', async () => {
    const readObject = vi.fn();
    await expect(readPluginOperationInput({
      instanceId: 'tenant-a',
      blobRef: 'plugin-operation-input:../tenant-b',
    }, { readObject } as never)).rejects.toThrow('invalid_plugin_operation_input_ref');
    expect(readObject).not.toHaveBeenCalled();
  });
});

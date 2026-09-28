import { describe, expect, it, vi } from 'vitest';

import {
  readPluginOperationArtifact,
  readPluginOperationInput,
  storePluginOperationArtifact,
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

describe('plugin operation result artifacts', () => {
  it('stores and reads result bytes through the same instance-scoped key', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const writeObject = vi.fn(async () => ({ etag: 'etag' }));
    const readObject = vi.fn(async () => ({ body, contentType: 'application/pdf' }));
    const storagePort = { writeObject, readObject } as never;

    const artifact = await storePluginOperationArtifact(
      {
        instanceId: 'tenant-a',
        body,
        contentType: 'application/pdf',
        fileName: 'result.pdf',
        now: new Date('2026-09-28T12:00:00.000Z'),
      },
      storagePort
    );

    expect(artifact).toMatchObject({
      contentType: 'application/pdf',
      fileName: 'result.pdf',
      sizeBytes: body.byteLength,
      expiresAt: '2026-09-29T12:00:00.000Z',
    });
    const storageKey = `tenant-a/plugin-operation-artifacts/${artifact.artifactId}`;
    expect(writeObject).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'tenant-a',
      storageKey,
      body,
    }));
    await expect(readPluginOperationArtifact(
      { instanceId: 'tenant-a', artifactId: artifact.artifactId },
      storagePort
    )).resolves.toEqual({ body, contentType: 'application/pdf' });
    expect(readObject).toHaveBeenCalledWith({ instanceId: 'tenant-a', storageKey });
  });

  it('rejects malformed result IDs before reading storage', async () => {
    const readObject = vi.fn();
    await expect(readPluginOperationArtifact(
      { instanceId: 'tenant-a', artifactId: '../tenant-b' },
      { readObject } as never
    )).rejects.toThrow('invalid_plugin_operation_artifact_id');
    expect(readObject).not.toHaveBeenCalled();
  });
});

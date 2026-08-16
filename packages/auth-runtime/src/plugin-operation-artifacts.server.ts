import type { StudioJobResultArtifact } from '@sva/core';
import { createHash, randomUUID } from 'node:crypto';

import { createConfiguredMediaStoragePortForInstance } from './iam-media/storage-s3.js';
import type { MediaStoragePort } from './iam-media/storage-port.js';

const artifactRetentionMs = 24 * 60 * 60 * 1_000;

const createStorageKey = (instanceId: string, artifactId: string): string =>
  `${instanceId}/plugin-operation-artifacts/${artifactId}`;

export const storePluginOperationArtifact = async (
  input: Readonly<{
    instanceId: string;
    body: Uint8Array;
    contentType: string;
    fileName: string;
    now?: Date;
  }>,
  storagePort?: MediaStoragePort
): Promise<StudioJobResultArtifact> => {
  const artifactId = randomUUID();
  const port = storagePort ?? (await createConfiguredMediaStoragePortForInstance(input.instanceId));
  await port.writeObject({
    instanceId: input.instanceId,
    storageKey: createStorageKey(input.instanceId, artifactId),
    body: input.body,
    contentType: input.contentType,
  });

  return {
    artifactId,
    contentType: input.contentType,
    fileName: input.fileName,
    sizeBytes: input.body.byteLength,
    sha256: createHash('sha256').update(input.body).digest('hex'),
    expiresAt: new Date((input.now ?? new Date()).getTime() + artifactRetentionMs).toISOString(),
  };
};

export const readPluginOperationArtifact = async (
  input: Readonly<{ instanceId: string; artifactId: string }>,
  storagePort?: MediaStoragePort
): Promise<Readonly<{ body: Uint8Array; contentType?: string }>> => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.artifactId)
  ) {
    throw new Error('invalid_plugin_operation_artifact_id');
  }
  const port = storagePort ?? (await createConfiguredMediaStoragePortForInstance(input.instanceId));
  const stored = await port.readObject({
    instanceId: input.instanceId,
    storageKey: createStorageKey(input.instanceId, input.artifactId),
  });
  return { body: stored.body, contentType: stored.contentType };
};

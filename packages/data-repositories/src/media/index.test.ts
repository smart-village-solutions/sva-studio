import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createMediaRepository } from './index.js';

const assetRow = {
  id: 'asset-1',
  instance_id: 'tenant-a',
  storage_key: 'tenant-a/originals/asset-1.jpg',
  media_type: 'image',
  mime_type: 'image/jpeg',
  byte_size: 1024,
  visibility: 'public',
  upload_status: 'processed',
  processing_status: 'ready',
  metadata: { title: 'Rathaus', altText: 'Rathaus außen' },
  technical: { width: 1200, height: 800 },
  created_at: '2026-04-29T10:00:00.000Z',
  updated_at: '2026-04-29T10:05:00.000Z',
};

const referenceRow = {
  id: 'ref-1',
  asset_id: 'asset-1',
  target_type: 'news',
  target_id: 'news-1',
  role: 'teaser_image',
  sort_order: 0,
  created_at: '2026-04-29T10:06:00.000Z',
};

const variantRow = {
  id: 'variant-1',
  asset_id: 'asset-1',
  variant_key: 'teaser-landscape',
  preset_key: 'news-teaser',
  format: 'webp',
  width: 640,
  height: 360,
  storage_key: 'tenant-a/variants/asset-1/teaser-landscape.webp',
  generation_status: 'ready',
  created_at: '2026-04-29T10:07:00.000Z',
  updated_at: '2026-04-29T10:08:00.000Z',
};

const uploadSessionRow = {
  id: 'upload-1',
  instance_id: 'tenant-a',
  asset_id: 'asset-1',
  storage_key: 'tenant-a/uploads/upload-1.bin',
  mime_type: 'image/jpeg',
  byte_size: 2048,
  status: 'validated',
  expires_at: '2026-04-29T11:00:00.000Z',
  created_at: '2026-04-29T10:01:00.000Z',
  updated_at: '2026-04-29T10:02:00.000Z',
};

const storageUsageRow = {
  instance_id: 'tenant-a',
  total_bytes: 4096,
  asset_count: 3,
  updated_at: '2026-04-29T10:09:00.000Z',
};

const storageQuotaRow = {
  instance_id: 'tenant-a',
  max_bytes: 8192,
  updated_at: '2026-04-29T10:10:00.000Z',
};

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('media repository', () => {
  it('upserts assets and serializes metadata payloads', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await repository.upsertAsset({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: { title: 'Rathaus' },
      technical: { width: 1200 },
    });

    expect(statements[0]?.text.includes('INSERT INTO iam.media_assets')).toBe(true);
    expect(statements[0]?.values.slice(0, 4)).toEqual(['asset-1', 'tenant-a', 'tenant-a/originals/asset-1.jpg', 'image']);
    expect(statements[0]?.values[9]).toBe(JSON.stringify({ title: 'Rathaus' }));
  });

  it('maps asset lookups and filtered asset listings', async () => {
    const { executor, statements } = createQueuedExecutor([[assetRow], [assetRow]]);
    const repository = createMediaRepository(executor);

    await expect(repository.getAssetById('tenant-a', 'asset-1')).resolves.toEqual({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: { title: 'Rathaus', altText: 'Rathaus außen' },
      technical: { width: 1200, height: 800 },
      createdAt: '2026-04-29T10:00:00.000Z',
      updatedAt: '2026-04-29T10:05:00.000Z',
    });

    await expect(
      repository.listAssets({
        instanceId: 'tenant-a',
        search: ' Rathaus ',
        visibility: 'public',
        limit: 10,
        offset: 20,
      })
    ).resolves.toHaveLength(1);
    expect(statements[1]?.values).toEqual(['tenant-a', '%rathaus%', 'public', 10, 20]);
  });

  it('keeps asset lookup fail-closed across instances', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await expect(repository.getAssetById('tenant-b', 'asset-1')).resolves.toBeNull();
    expect(statements[0]?.values).toEqual(['tenant-b', 'asset-1']);
  });

  it('replaces target references and exposes usage impact', async () => {
    const { executor, statements } = createQueuedExecutor([[], [], [], [referenceRow], [referenceRow]]);
    const repository = createMediaRepository(executor);

    await repository.replaceReferences({
      instanceId: 'tenant-a',
      targetType: 'news',
      targetId: 'news-1',
      references: [
        {
          id: 'ref-1',
          assetId: 'asset-1',
          targetType: 'news',
          targetId: 'news-1',
          role: 'teaser_image',
          sortOrder: 0,
        },
        {
          id: 'ref-2',
          assetId: 'asset-2',
          targetType: 'news',
          targetId: 'news-1',
          role: 'gallery_item',
          sortOrder: 1,
        },
      ],
    });

    expect(statements[0]?.text.includes('DELETE FROM iam.media_references')).toBe(true);
    expect(statements[1]?.values.slice(0, 4)).toEqual(['ref-1', 'tenant-a', 'asset-1', 'news']);
    expect(statements[2]?.values.slice(0, 4)).toEqual(['ref-2', 'tenant-a', 'asset-2', 'news']);

    await expect(repository.getUsageImpact('tenant-a', 'asset-1')).resolves.toEqual({
      assetId: 'asset-1',
      totalReferences: 1,
      references: [
        {
          id: 'ref-1',
          assetId: 'asset-1',
          targetType: 'news',
          targetId: 'news-1',
          role: 'teaser_image',
          sortOrder: 0,
          createdAt: '2026-04-29T10:06:00.000Z',
        },
      ],
    });

    await expect(repository.listReferencesByTarget('tenant-a', 'news', 'news-1')).resolves.toEqual([
      {
        id: 'ref-1',
        assetId: 'asset-1',
        targetType: 'news',
        targetId: 'news-1',
        role: 'teaser_image',
        sortOrder: 0,
        createdAt: '2026-04-29T10:06:00.000Z',
      },
    ]);
  });

  it('persists variants and upload sessions and reads storage usage', async () => {
    const { executor, statements } = createQueuedExecutor([[], [variantRow], [], [uploadSessionRow], [], [storageUsageRow]]);
    const repository = createMediaRepository(executor);

    await repository.upsertVariant('tenant-a', {
      id: 'variant-1',
      assetId: 'asset-1',
      variantKey: 'teaser-landscape',
      presetKey: 'news-teaser',
      format: 'webp',
      width: 640,
      height: 360,
      storageKey: 'tenant-a/variants/asset-1/teaser-landscape.webp',
      generationStatus: 'ready',
    });

    expect(statements[0]?.text.includes('INSERT INTO iam.media_variants')).toBe(true);
    expect(statements[0]?.values.slice(0, 4)).toEqual(['variant-1', 'tenant-a', 'asset-1', 'teaser-landscape']);

    await expect(repository.listVariantsByAssetId('tenant-a', 'asset-1')).resolves.toEqual([
      {
        id: 'variant-1',
        assetId: 'asset-1',
        variantKey: 'teaser-landscape',
        presetKey: 'news-teaser',
        format: 'webp',
        width: 640,
        height: 360,
        storageKey: 'tenant-a/variants/asset-1/teaser-landscape.webp',
        generationStatus: 'ready',
        createdAt: '2026-04-29T10:07:00.000Z',
        updatedAt: '2026-04-29T10:08:00.000Z',
      },
    ]);

    await repository.upsertUploadSession({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/uploads/upload-1.bin',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      status: 'validated',
      expiresAt: '2026-04-29T11:00:00.000Z',
    });

    expect(statements[2]?.text.includes('INSERT INTO iam.media_upload_sessions')).toBe(true);
    expect(statements[2]?.values.slice(0, 4)).toEqual(['upload-1', 'tenant-a', 'asset-1', 'tenant-a/uploads/upload-1.bin']);

    await expect(repository.getUploadSessionById('tenant-a', 'upload-1')).resolves.toEqual({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/uploads/upload-1.bin',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      status: 'validated',
      expiresAt: '2026-04-29T11:00:00.000Z',
      createdAt: '2026-04-29T10:01:00.000Z',
      updatedAt: '2026-04-29T10:02:00.000Z',
    });

    await repository.upsertStorageUsage({
      instanceId: 'tenant-a',
      totalBytes: 4096,
      assetCount: 3,
    });

    expect(statements[4]?.text.includes('INSERT INTO iam.media_storage_usage')).toBe(true);
    expect(statements[4]?.values).toEqual(['tenant-a', 4096, 3]);

    await expect(repository.getStorageUsage('tenant-a')).resolves.toEqual({
      instanceId: 'tenant-a',
      totalBytes: 4096,
      assetCount: 3,
      updatedAt: '2026-04-29T10:09:00.000Z',
    });
  });

  it('persists storage quotas and evaluates hard quota violations against current usage', async () => {
    const { executor, statements } = createQueuedExecutor([[], [storageQuotaRow], [storageQuotaRow], [storageUsageRow]]);
    const repository = createMediaRepository(executor);

    await repository.upsertStorageQuota({
      instanceId: 'tenant-a',
      maxBytes: 8192,
    });

    expect(statements[0]?.text.includes('INSERT INTO iam.media_storage_quotas')).toBe(true);
    expect(statements[0]?.values).toEqual(['tenant-a', 8192]);

    await expect(repository.getStorageQuota('tenant-a')).resolves.toEqual({
      instanceId: 'tenant-a',
      maxBytes: 8192,
      updatedAt: '2026-04-29T10:10:00.000Z',
    });

    await expect(repository.wouldExceedStorageQuota('tenant-a', 5000)).resolves.toEqual({
      instanceId: 'tenant-a',
      currentBytes: 4096,
      additionalBytes: 5000,
      maxBytes: 8192,
      wouldExceed: true,
    });
  });

  it('deletes assets in an instance-scoped way', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await repository.deleteAsset('tenant-a', 'asset-1');

    expect(statements[0]?.text.includes('DELETE FROM iam.media_assets')).toBe(true);
    expect(statements[0]?.values).toEqual(['tenant-a', 'asset-1']);
  });
});

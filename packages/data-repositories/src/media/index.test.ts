import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createMediaRepository, mediaStatements } from './index.js';

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
  claim_token: null,
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

const contentSaveOperationRow = {
  id: '00000000-0000-4000-8000-000000000001',
  instance_id: 'tenant-a',
  actor_subject: 'actor-1',
  target_type: 'news.article',
  target_id: null,
  status: 'preparing',
  error_code: null,
  expires_at: '2026-08-18T10:00:00.000Z',
  created_at: '2026-08-18T09:00:00.000Z',
  updated_at: null,
};

const contentSaveIdentity = {
  instanceId: 'tenant-a',
  operationId: contentSaveOperationRow.id,
  actorSubject: 'actor-1',
};

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(
      statement: SqlStatement
    ): Promise<SqlExecutionResult<TRow>> {
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
  it('round-trips private editing data without letting ordinary upserts clear a deletion claim', async () => {
    const document = { version: 1, editor: 'filerobot', state: { annotations: {} } };
    const { executor, statements } = createQueuedExecutor([
      [
        {
          ...assetRow,
          editing_source_asset_id: 'source-1',
          editing_document: document,
          deletion_pending: true,
        },
      ],
      [assetRow],
      [{ ...assetRow, id: 'source-1', lifecycle_status: 'active' }],
      [],
    ]);
    const repository = createMediaRepository(executor);
    const asset = await repository.getAssetById('tenant-a', 'asset-1');
    expect(asset).toMatchObject({
      editingSourceAssetId: 'source-1',
      editingDocument: document,
      deletionPending: true,
    });
    if (!asset) throw new Error('fixture_asset_missing');
    await repository.upsertAsset({ ...asset, deletionPending: false });
    expect(statements[1]?.text).toContain('FOR UPDATE');
    expect(statements[3]?.values.slice(16)).toEqual(['source-1', null, JSON.stringify(document)]);
    expect(statements[3]?.text).not.toContain('deletion_pending =');
  });

  it('locks the existing root before checking dependencies for a visibility change', async () => {
    const { executor, statements } = createQueuedExecutor([
      [assetRow],
      [{ id: 'provisional-copy' }],
    ]);
    const repository = createMediaRepository(executor);
    await expect(
      repository.upsertAsset({
        id: assetRow.id,
        instanceId: assetRow.instance_id,
        storageKey: assetRow.storage_key,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
      })
    ).rejects.toThrow('media_visibility_fixed');
    expect(statements[0]?.text).toContain('FOR UPDATE');
    expect(statements[1]?.text).not.toContain('lifecycle_status');
    expect(statements).toHaveLength(2);
  });

  it('maps a private local source and keeps it out of library queries', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          ...assetRow,
          editing_source_key: '.protected/tenant-a/asset-1/source.jpg',
          editing_document: { version: 1 },
          deletion_pending: false,
        },
      ],
      [],
    ]);
    const repository = createMediaRepository(executor);
    expect(await repository.getAssetById('tenant-a', 'asset-1')).toMatchObject({
      editingSourceKey: '.protected/tenant-a/asset-1/source.jpg',
      editingDocument: { version: 1 },
      deletionPending: false,
    });
    await repository.listAssets({ instanceId: 'tenant-a' });
    expect(statements[1]?.text).not.toContain('editing_document');
    expect(statements[1]?.text).not.toContain('editing_source_key');
  });

  it.each([
    undefined,
    { deletion_pending: true },
    { lifecycle_status: 'provisional' },
    { upload_status: 'pending' },
    { processing_status: 'failed' },
    { editing_source_asset_id: 'other-source' },
    { visibility: 'protected' },
  ])(
    'rejects an unavailable or incompatible editing source before writing a copy: %o',
    async (override) => {
      const { executor, statements } = createQueuedExecutor([
        [],
        override ? [{ ...assetRow, lifecycle_status: 'active', ...override }] : [],
      ]);
      await expect(
        createMediaRepository(executor).upsertAsset({
          id: 'copy',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/copy.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 100,
          visibility: 'public',
          uploadStatus: 'pending',
          processingStatus: 'pending',
          metadata: {},
          technical: {},
          editingSourceAssetId: 'asset-1',
        })
      ).rejects.toThrow('media_editing_source_unavailable');
      expect(statements).toHaveLength(2);
    }
  );

  it('claims deletion after a source lock and finalizes quota only for a deleted row', async () => {
    const { executor, statements } = createQueuedExecutor([
      [],
      [assetRow],
      [{ id: 'asset-1' }],
      [{ deleted: true }],
      [{ deleted: false }],
      [],
      [],
    ]);
    const repository = createMediaRepository(executor);
    expect(await repository.claimAssetDeletion('tenant-a', 'asset-1')).toBe(true);
    expect(statements[1]?.text).toContain('FOR UPDATE');
    expect(statements[2]?.text).toContain('editing_source_asset_id = $2');
    expect(statements[2]?.text).toContain('iam.media_content_save_operation_references');
    expect(await repository.finalizeAssetDeletion('tenant-a', 'asset-1')).toBe(true);
    expect(await repository.finalizeAssetDeletion('tenant-a', 'asset-1')).toBe(false);
    expect(statements[3]?.text).toContain('deletion_pending = true');
    expect(statements[3]?.text).toContain('editingSourceBytes');
    expect(await repository.claimAssetDeletion('tenant-a', 'missing')).toBe(false);
    expect(statements).toHaveLength(7);
  });

  it('returns a blocked deletion claim without hiding readable editing copies', async () => {
    const { executor, statements } = createQueuedExecutor([
      [],
      [assetRow],
      [],
      [
        { id: 'copy-1', metadata: { title: 'Bearbeitet' } },
        { id: 'copy-2', metadata: null },
      ],
    ]);
    const repository = createMediaRepository(executor);
    expect(await repository.claimAssetDeletion('tenant-a', 'asset-1')).toBe(false);
    expect(await repository.listEditingCopies('tenant-a', 'asset-1')).toEqual([
      { id: 'copy-1', metadata: { title: 'Bearbeitet' } },
      { id: 'copy-2', metadata: {} },
    ]);
    expect(statements[3]?.text).toContain("lifecycle_status = 'active'");
  });

  it('upserts assets and serializes metadata payloads', async () => {
    const { executor, statements } = createQueuedExecutor([[], []]);
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

    expect(statements[1]?.text.includes('INSERT INTO iam.media_assets')).toBe(true);
    expect(statements[1]?.values.slice(0, 4)).toEqual([
      'asset-1',
      'tenant-a',
      'tenant-a/originals/asset-1.jpg',
      'image',
    ]);
    expect(statements[1]?.values[9]).toBe(JSON.stringify({ title: 'Rathaus' }));
    expect(statements[1]?.values[11]).toBe('active');
  });

  it('persists provisional ownership and keeps provisional assets out of library queries', async () => {
    const { executor, statements } = createQueuedExecutor([[], [], []]);
    const repository = createMediaRepository(executor);
    await repository.upsertAsset({
      id: 'asset-draft',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-draft.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 10,
      visibility: 'public',
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: 'provisional',
      provisionalOperationId: '00000000-0000-4000-8000-000000000001',
      provisionalOwnerSubject: 'user-1',
      provisionalDraftId: '00000000-0000-4000-8000-000000000002',
      provisionalExpiresAt: '2026-08-18T00:00:00.000Z',
      metadata: {},
      technical: {},
    });
    await repository.listAssets({ instanceId: 'tenant-a' });

    expect(statements[1]?.values.slice(11, 16)).toEqual([
      'provisional',
      '00000000-0000-4000-8000-000000000001',
      'user-1',
      '00000000-0000-4000-8000-000000000002',
      '2026-08-18T00:00:00.000Z',
    ]);
    expect(statements[2]?.text).toContain("lifecycle_status = 'active'");
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
    expect(statements[1]?.text).toContain('OR lower(storage_key) LIKE $2');
    expect(statements[1]?.text).toContain('lower(media_tag.value) LIKE $2');
    expect(statements[1]?.values).toEqual(['tenant-a', '%rathaus%', 'public', 10, 20]);
  });

  it('uses default asset list filters and normalizes nullable asset metadata fail-closed', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          ...assetRow,
          metadata: null,
          technical: null,
          created_at: null,
          updated_at: null,
        },
      ],
    ]);
    const repository = createMediaRepository(executor);

    await expect(
      repository.listAssets({ instanceId: 'tenant-a', search: '   ', visibility: '   ' })
    ).resolves.toEqual([
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);

    expect(statements[0]?.values).toEqual(['tenant-a', 25, 0]);
  });

  it('orders asset listings with null updated timestamps last and newer created assets first as fallback', async () => {
    const { executor, statements } = createQueuedExecutor([[assetRow]]);
    const repository = createMediaRepository(executor);

    await repository.listAssets({ instanceId: 'tenant-a' });

    expect(statements[0]?.text).toContain('ORDER BY updated_at DESC NULLS LAST');
    expect(statements[0]?.text).toContain('created_at DESC');
  });

  it('uses storage-key keyset pagination for cursor listings', async () => {
    const { executor, statements } = createQueuedExecutor([[assetRow]]);
    const repository = createMediaRepository(executor);

    await repository.listAssets({
      instanceId: 'tenant-a',
      afterStorageKey: 'tenant-a/originals/asset-0.jpg',
      order: 'storageKeyAsc',
      limit: 26,
    });

    expect(statements[0]?.text).toContain('storage_key COLLATE "C" > $2');
    expect(statements[0]?.text).toContain('ORDER BY storage_key COLLATE "C" ASC');
    expect(statements[0]?.values).toEqual(['tenant-a', 'tenant-a/originals/asset-0.jpg', 26, 0]);
  });

  it('counts matching assets without pagination clauses', async () => {
    const { executor, statements } = createQueuedExecutor([[{ total: 31 }]]);
    const repository = createMediaRepository(executor);

    await expect(
      repository.countAssets({
        instanceId: 'tenant-a',
        search: ' Rathaus ',
        visibility: 'public',
      })
    ).resolves.toBe(31);

    expect(statements[0]?.text).toContain('SELECT COUNT(*)::int AS total');
    expect(statements[0]?.text).not.toContain('LIMIT');
    expect(statements[0]?.text).not.toContain('OFFSET');
    expect(statements[0]?.values).toEqual(['tenant-a', '%rathaus%', 'public']);
  });

  it('falls back to zero when the asset count query returns no row', async () => {
    const { executor } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await expect(
      repository.countAssets({
        instanceId: 'tenant-a',
      })
    ).resolves.toBe(0);
  });

  it('keeps asset lookup fail-closed across instances', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await expect(repository.getAssetById('tenant-b', 'asset-1')).resolves.toBeNull();
    expect(statements[0]?.values).toEqual(['tenant-b', 'asset-1']);
  });

  it('keeps existing references when an asset is being deleted', async () => {
    const { executor, statements } = createQueuedExecutor([[], []]);
    const repository = createMediaRepository(executor);
    const references = [
      { id: 'ref', assetId: 'asset-1', targetType: 'news', targetId: 'news-1', role: 'teaser' },
    ];
    await expect(
      repository.replaceReferences({
        instanceId: 'tenant-a',
        targetType: 'news',
        targetId: 'news-1',
        references,
      })
    ).rejects.toThrow('media_reference_asset_unavailable');
    expect(
      await repository.replaceContentSaveOperationReferences({ ...contentSaveIdentity, references })
    ).toBe(false);
    expect(statements).toHaveLength(2);
    expect(statements.every(({ text }) => !text.includes('DELETE FROM'))).toBe(true);
  });

  it('replaces target references and exposes usage impact', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ id: 'asset-1' }, { id: 'asset-2' }],
      [],
      [],
      [],
      [referenceRow],
      [referenceRow],
    ]);
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

    expect(statements[0]?.text).toContain('FOR UPDATE');
    expect(statements[0]?.values).toEqual(['tenant-a', ['asset-1', 'asset-2']]);
    expect(statements[1]?.text.includes('DELETE FROM iam.media_references')).toBe(true);
    expect(statements[2]?.values.slice(0, 4)).toEqual(['ref-1', 'tenant-a', 'asset-1', 'news']);
    expect(statements[3]?.values.slice(0, 4)).toEqual(['ref-2', 'tenant-a', 'asset-2', 'news']);

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
    const { executor, statements } = createQueuedExecutor([
      [],
      [variantRow],
      [],
      [],
      [uploadSessionRow],
      [],
      [],
      [storageUsageRow],
    ]);
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
    expect(statements[0]?.text).toContain('ON CONFLICT (asset_id, variant_key) DO UPDATE');
    expect(statements[0]?.values.slice(0, 4)).toEqual([
      'variant-1',
      'tenant-a',
      'asset-1',
      'teaser-landscape',
    ]);

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

    await repository.deleteVariantsByAssetId('tenant-a', 'asset-1');

    expect(statements[2]?.text.includes('DELETE FROM iam.media_variants')).toBe(true);
    expect(statements[2]?.values).toEqual(['tenant-a', 'asset-1']);

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

    expect(statements[3]?.text.includes('INSERT INTO iam.media_upload_sessions')).toBe(true);
    expect(statements[3]?.values.slice(0, 4)).toEqual([
      'upload-1',
      'tenant-a',
      'asset-1',
      'tenant-a/uploads/upload-1.bin',
    ]);

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

    expect(statements[5]?.text.includes('INSERT INTO iam.media_storage_usage')).toBe(true);
    expect(statements[5]?.values).toEqual(['tenant-a', 4096, 3]);

    await repository.applyStorageUsageDelta({
      instanceId: 'tenant-a',
      totalBytesDelta: -512,
      assetCountDelta: -1,
    });

    expect(statements[6]?.text).toContain('VALUES ($1, $2, $3)');
    expect(statements[6]?.text).toContain(
      'GREATEST(iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes, 0)'
    );
    expect(statements[6]?.values).toEqual(['tenant-a', -512, -1]);

    await expect(repository.getStorageUsage('tenant-a')).resolves.toEqual({
      instanceId: 'tenant-a',
      totalBytes: 4096,
      assetCount: 3,
      updatedAt: '2026-04-29T10:09:00.000Z',
    });
  });

  it('refreshes upload retries only while the session remains pending', async () => {
    const { executor, statements } = createQueuedExecutor([[{ id: 'upload-1' }], []]);
    const repository = createMediaRepository(executor);
    const input = {
      instanceId: 'tenant-a',
      sessionId: 'upload-1',
      storageKey: 'tenant-a/uploads/upload-1-retry.bin',
      expiresAt: '2026-04-29T12:00:00.000Z',
    };

    await expect(repository.refreshPendingUploadSession(input)).resolves.toBe(true);
    await expect(repository.refreshPendingUploadSession(input)).resolves.toBe(false);

    expect(statements[0]?.text).toContain("AND status = 'pending'");
    expect(statements[0]?.text).toContain('RETURNING id');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'upload-1',
      'tenant-a/uploads/upload-1-retry.bin',
      '2026-04-29T12:00:00.000Z',
    ]);
  });

  it('normalizes nullable variant, upload session, and reference fields', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          ...variantRow,
          height: null,
          created_at: null,
          updated_at: null,
        },
      ],
      [
        {
          ...uploadSessionRow,
          expires_at: null,
          created_at: null,
          updated_at: null,
        },
      ],
      [
        {
          ...referenceRow,
          sort_order: null,
          created_at: null,
        },
      ],
    ]);
    const repository = createMediaRepository(executor);

    await expect(repository.listVariantsByAssetId('tenant-a', 'asset-1')).resolves.toEqual([
      {
        id: 'variant-1',
        assetId: 'asset-1',
        variantKey: 'teaser-landscape',
        presetKey: 'news-teaser',
        format: 'webp',
        width: 640,
        height: undefined,
        storageKey: 'tenant-a/variants/asset-1/teaser-landscape.webp',
        generationStatus: 'ready',
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);

    await expect(repository.getUploadSessionById('tenant-a', 'upload-1')).resolves.toEqual({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/uploads/upload-1.bin',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      status: 'validated',
      expiresAt: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });

    await expect(repository.listReferencesByAssetId('tenant-a', 'asset-1')).resolves.toEqual([
      {
        id: 'ref-1',
        assetId: 'asset-1',
        targetType: 'news',
        targetId: 'news-1',
        role: 'teaser_image',
        sortOrder: undefined,
        createdAt: undefined,
      },
    ]);
  });

  it('persists storage quotas and evaluates hard quota violations against current usage', async () => {
    const { executor, statements } = createQueuedExecutor([
      [],
      [storageQuotaRow],
      [storageQuotaRow],
      [storageUsageRow],
    ]);
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

  it('rotates a fresh uploaded claim only when requested by the processing job', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          ...uploadSessionRow,
          status: 'uploaded',
          claim_token: 'new-claim',
          replaced_claim_token: 'old-claim',
        },
      ],
    ]);
    const result = await createMediaRepository(executor).claimUploadSession(
      'tenant-a',
      'upload-1',
      true
    );
    expect(result).toMatchObject({ claimToken: 'new-claim', replacedClaimToken: 'old-claim' });
    expect(statements[0]?.values).toEqual(['tenant-a', 'upload-1', 600, true]);
    expect(statements[0]?.text).toContain('claim_token = gen_random_uuid()');
    expect(statements[0]?.text).toContain('$4::boolean OR updated_at');
  });

  it('claims pending upload sessions atomically and applies actual usage within quota', async () => {
    const claimedSessionRow = {
      ...uploadSessionRow,
      status: 'uploaded',
      claim_token: '00000000-0000-4000-8000-000000000099',
      replaced_claim_token: '00000000-0000-4000-8000-000000000098',
    };
    const { executor, statements } = createQueuedExecutor([
      [claimedSessionRow],
      [],
      [{ claimed: true }],
      [{ claimed: false }],
    ]);
    const repository = createMediaRepository(executor);

    await expect(repository.claimUploadSession('tenant-a', 'upload-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'upload-1',
        status: 'uploaded',
        claimToken: '00000000-0000-4000-8000-000000000099',
        replacedClaimToken: '00000000-0000-4000-8000-000000000098',
      })
    );
    await expect(repository.claimUploadSession('tenant-a', 'upload-1')).resolves.toBeNull();
    await expect(
      repository.tryApplyStorageUsageWithinQuota({
        instanceId: 'tenant-a',
        totalBytes: 2048,
        assetCount: 1,
      })
    ).resolves.toBe(true);
    await expect(
      repository.tryApplyStorageUsageWithinQuota({
        instanceId: 'tenant-a',
        totalBytes: 4096,
        assetCount: 1,
      })
    ).resolves.toBe(false);

    expect(statements[0]?.text).toContain("status = 'pending'");
    expect(statements[0]?.text).toContain("status = 'uploaded'");
    expect(statements[0]?.text).toContain('claim_token = gen_random_uuid()');
    expect(statements[0]?.text).toContain('claim_token AS replaced_claim_token');
    expect(statements[0]?.text).toContain('claimable.replaced_claim_token');
    expect(statements[0]?.text).toContain('FOR UPDATE');
    expect(statements[0]?.text).toContain("updated_at < NOW() - ($3 * INTERVAL '1 second')");
    expect(statements[0]?.text).toContain(
      "status = 'pending'\n        AND (expires_at IS NULL OR expires_at > NOW())"
    );
    expect(statements[0]?.text).not.toContain(
      ')\n  AND (expires_at IS NULL OR expires_at > NOW())\nRETURNING'
    );
    expect(statements[0]?.values).toEqual(['tenant-a', 'upload-1', 600, false]);
    expect(statements[2]?.text).toContain('ON CONFLICT (instance_id) DO UPDATE');
    expect(statements[2]?.text).toContain(
      'iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes <='
    );
    expect(statements[2]?.values).toEqual(['tenant-a', 2048, 1]);
  });

  it('locks finalization only for the current upload claim token', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ claimed: true }],
      [{ claimed: false }],
    ]);
    const repository = createMediaRepository(executor);

    await expect(
      repository.lockUploadSessionClaim({
        instanceId: 'tenant-a',
        sessionId: 'upload-1',
        claimToken: '00000000-0000-4000-8000-000000000099',
      })
    ).resolves.toBe(true);
    await expect(
      repository.lockUploadSessionClaim({
        instanceId: 'tenant-a',
        sessionId: 'upload-1',
        claimToken: '00000000-0000-4000-8000-000000000098',
      })
    ).resolves.toBe(false);

    expect(statements[0]?.text).toContain("status = 'uploaded'");
    expect(statements[0]?.text).toContain('claim_token = $3::uuid');
    expect(statements[0]?.text).toContain('FOR UPDATE');
  });

  it('handles missing quotas, missing usage rows, and empty reference replacements', async () => {
    const { executor, statements } = createQueuedExecutor([[], [], [], []]);
    const repository = createMediaRepository(executor);

    await repository.replaceReferences({
      instanceId: 'tenant-a',
      targetType: 'poi',
      targetId: 'poi-1',
      references: [],
    });

    expect(statements[0]?.text.includes('DELETE FROM iam.media_references')).toBe(true);
    expect(statements).toHaveLength(1);

    await expect(repository.getStorageUsage('tenant-a')).resolves.toBeNull();
    await expect(repository.getStorageQuota('tenant-a')).resolves.toBeNull();
    await expect(repository.wouldExceedStorageQuota('tenant-a', 512)).resolves.toEqual({
      instanceId: 'tenant-a',
      currentBytes: 0,
      additionalBytes: 512,
      maxBytes: null,
      wouldExceed: false,
    });
  });

  it('deletes assets in an instance-scoped way', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createMediaRepository(executor);

    await repository.deleteAsset('tenant-a', 'asset-1');

    expect(statements[0]?.text.includes('DELETE FROM iam.media_assets')).toBe(true);
    expect(statements[0]?.values).toEqual(['tenant-a', 'asset-1']);
  });

  it('locks only open content-save operations before publishing upload variants', async () => {
    const { executor, statements } = createQueuedExecutor([[{ open: true }], [{ open: false }]]);
    const repository = createMediaRepository(executor);
    const input = {
      instanceId: 'tenant-a',
      operationId: '00000000-0000-4000-8000-000000000001',
    };

    await expect(repository.lockOpenContentSaveOperationForUpload(input)).resolves.toBe(true);
    await expect(repository.lockOpenContentSaveOperationForUpload(input)).resolves.toBe(false);

    expect(statements[0]?.text).toContain("status IN ('preparing', 'uploading')");
    expect(statements[0]?.text).toContain('FOR UPDATE');
    expect(statements[0]?.values).toEqual([input.operationId, input.instanceId]);
  });

  it('makes content-save creation and draft upload lookup idempotent', () => {
    const createStatement = mediaStatements.createContentSaveOperation({
      id: '00000000-0000-4000-8000-000000000001',
      instanceId: 'tenant-a',
      actorSubject: 'actor-1',
      targetType: 'news.article',
      status: 'preparing',
      expiresAt: '2026-08-18T10:00:00.000Z',
    });
    const draftLookup = mediaStatements.getProvisionalAssetByDraft({
      instanceId: 'tenant-a',
      operationId: '00000000-0000-4000-8000-000000000001',
      actorSubject: 'actor-1',
      draftId: '00000000-0000-4000-8000-000000000002',
    });

    expect(createStatement.text).toContain('ON CONFLICT (id) DO UPDATE');
    expect(createStatement.text).toContain('actor_subject = EXCLUDED.actor_subject');
    expect(draftLookup.text).toContain("lifecycle_status = 'provisional'");
    expect(draftLookup.text).toContain('provisional_owner_subject = $4');
    expect(draftLookup.values).toEqual([
      'tenant-a',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'actor-1',
    ]);
  });

  it('executes and maps every content-save lifecycle repository transition', async () => {
    const { executor, statements } = createQueuedExecutor([
      [contentSaveOperationRow],
      [contentSaveOperationRow],
      [],
      [{ id: 'asset-1' }],
      [{ successful: true }],
      [{ successful: false }],
      [{}],
      [],
      [{}],
      [{ successful: true }],
      [{ successful: false }],
      [{}],
      [],
      [{ ...contentSaveOperationRow, status: 'abandon_pending', error_code: 'save_failed' }],
      [],
      [{ successful: true }],
      [{ successful: false }],
    ]);
    const repository = createMediaRepository(executor);

    await expect(
      repository.createContentSaveOperation({
        id: contentSaveOperationRow.id,
        instanceId: 'tenant-a',
        actorSubject: 'actor-1',
        targetType: 'news.article',
        status: 'preparing',
        expiresAt: contentSaveOperationRow.expires_at,
      })
    ).resolves.toEqual({
      id: contentSaveOperationRow.id,
      instanceId: 'tenant-a',
      actorSubject: 'actor-1',
      targetType: 'news.article',
      status: 'preparing',
      expiresAt: contentSaveOperationRow.expires_at,
      createdAt: contentSaveOperationRow.created_at,
      updatedAt: undefined,
    });
    await expect(repository.getContentSaveOperation(contentSaveIdentity)).resolves.toEqual(
      expect.objectContaining({ id: contentSaveOperationRow.id, status: 'preparing' })
    );
    await expect(repository.getContentSaveOperation(contentSaveIdentity)).resolves.toBeNull();
    await expect(
      repository.replaceContentSaveOperationReferences({
        ...contentSaveIdentity,
        references: [{ id: 'ref-1', assetId: 'asset-1', role: 'teaser', sortOrder: 0 }],
      })
    ).resolves.toBe(true);
    await expect(
      repository.replaceContentSaveOperationReferences({ ...contentSaveIdentity, references: [] })
    ).resolves.toBe(false);
    await expect(
      repository.markContentSaveOperationContentSaved({
        ...contentSaveIdentity,
        targetId: 'news-1',
      })
    ).resolves.toBe(true);
    await expect(
      repository.markContentSaveOperationSavingContent(contentSaveIdentity)
    ).resolves.toBe(false);
    await expect(
      repository.markContentSaveOperationOutcomeUnknown({
        ...contentSaveIdentity,
        errorCode: 'timeout',
      })
    ).resolves.toBe(true);
    await expect(repository.commitContentSaveOperation(contentSaveIdentity)).resolves.toBe(true);
    await expect(repository.commitContentSaveOperation(contentSaveIdentity)).resolves.toBe(false);
    await expect(
      repository.markContentSaveOperationAbandonPending({
        ...contentSaveIdentity,
        errorCode: 'cancelled',
      })
    ).resolves.toBe(true);
    await expect(
      repository.finalizeContentSaveOperationAbandoned(contentSaveIdentity)
    ).resolves.toBe(false);
    await expect(
      repository.claimContentSaveOperationRecovery({
        instanceId: 'tenant-a',
        operationId: contentSaveOperationRow.id,
        leaseOwner: 'recovery-1',
        leaseExpiresAt: '2026-08-18T10:05:00.000Z',
        now: '2026-08-18T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({ status: 'abandon_pending', errorCode: 'save_failed' })
    );
    await expect(
      repository.claimContentSaveOperationRecovery({
        instanceId: 'tenant-a',
        operationId: contentSaveOperationRow.id,
        leaseOwner: 'recovery-1',
        leaseExpiresAt: '2026-08-18T10:05:00.000Z',
        now: '2026-08-18T10:00:00.000Z',
      })
    ).resolves.toBeNull();
    await expect(repository.finalizeContentSaveOperationCleanup(contentSaveIdentity)).resolves.toBe(
      true
    );
    await expect(repository.finalizeContentSaveOperationCleanup(contentSaveIdentity)).resolves.toBe(
      false
    );

    expect(statements).toHaveLength(17);
    expect(statements[0]?.text).toContain('INSERT INTO iam.media_content_save_operations');
    expect(statements[4]?.text).toContain(
      'DELETE FROM iam.media_content_save_operation_references'
    );
    expect(statements[4]?.values.slice(0, 3)).toEqual([
      contentSaveOperationRow.id,
      'tenant-a',
      'actor-1',
    ]);
    expect(statements[6]?.text).toContain("ELSE 'content_saved' END");
    expect(statements[9]?.text).toContain('INSERT INTO iam.media_references');
    expect(statements[13]?.text).toContain("status = 'reconciliation_required'");
    expect(statements[15]?.text).toContain('DELETE FROM iam.media_assets');
  });

  it('permits confirmed reference recovery while excluding cleanup states and target changes', () => {
    const statement = mediaStatements.markContentSaveOperationContentSaved({
      ...contentSaveIdentity,
      targetId: 'news-1',
    });
    expect(statement.values).toEqual([
      contentSaveIdentity.operationId,
      'tenant-a',
      'actor-1',
      'news-1',
    ]);
    expect(statement.text).toContain('instance_id = $2');
    expect(statement.text).toContain('actor_subject = $3');
    expect(statement.text).toContain("'outcome_unknown', 'reconciliation_required'");
    expect(statement.text).toContain('(target_id IS NULL OR target_id = $4)');
    expect(statement.text).toContain("status = 'committed' AND target_id = $4");
    expect(statement.text).toContain("CASE WHEN status = 'committed' THEN status ELSE 'content_saved' END");
    expect(statement.text).not.toContain("'abandon_pending'");
    expect(statement.text).not.toContain("'abandoned'");
  });

  it('claims only expired safe states and preserves unknown or confirmed outcomes', () => {
    const statement = mediaStatements.claimContentSaveOperationRecovery({
      instanceId: 'tenant-a',
      operationId: '00000000-0000-4000-8000-000000000001',
      leaseOwner: 'job-1',
      leaseExpiresAt: '2026-08-18T10:05:00.000Z',
      now: '2026-08-18T10:00:00.000Z',
    });

    expect(statement.text).toContain("status IN ('preparing', 'uploading', 'abandon_pending')");
    expect(statement.text).toContain("status = 'saving_content'");
    expect(statement.text).toContain("status = 'reconciliation_required'");
    expect(statement.text).not.toContain("status IN ('content_saved'");
    expect(statement.text).toContain('lease_expires_at <= $5::timestamptz');
  });

  it('finalizes cleanup and quota correction in one actor-bound transaction statement', () => {
    const statement = mediaStatements.finalizeContentSaveOperationCleanup({
      instanceId: 'tenant-a',
      operationId: '00000000-0000-4000-8000-000000000001',
      actorSubject: 'actor-1',
    });

    expect(statement.text).toContain('FOR UPDATE');
    expect(statement.text).toContain('actor_subject = $3');
    expect(statement.text).toContain('DELETE FROM iam.media_assets');
    expect(statement.text).toContain('DELETE FROM iam.media_content_save_operation_references');
    expect(statement.text).toContain('UPDATE iam.media_storage_usage');
    expect(statement.text).toContain('GREATEST(0, usage.total_bytes');
  });
});

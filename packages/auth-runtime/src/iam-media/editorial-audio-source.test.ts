import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { canUseEditorialAudioSources } from './editorial-audio-source.js';

const state = vi.hoisted(() => ({
  asset: vi.fn(),
  claim: vi.fn(),
  authorize: vi.fn(),
}));

vi.mock('./storage-s3-config.js', () => ({
  resolveMediaStorageConfig: () => ({
    endpoint: 'https://storage.test',
    publicBaseUrl: 'https://cdn.test/media',
  }),
  resolveMediaStorageConfigFromInterface: async () => null,
}));
vi.mock('./repository.js', () => ({
  withMediaService: (_instanceId: string, work: (service: unknown) => Promise<boolean>) =>
    work({ getAssetByStorageKey: state.asset, claimEditorialMediaWrite: state.claim }),
}));
vi.mock('./server-authorization.js', () => ({
  authorizeMediaPrimitiveForUser: state.authorize,
}));

const ownUrl = 'https://cdn.test/media/tenant/variants/asset/claim/original.mp3';
const ready = {
  id: 'asset',
  mediaType: 'audio',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  visibility: 'public',
  lifecycleStatus: 'active',
  technical: { scanStatus: 'clean' },
};
const operationId = 'bc0836d8-0608-49db-8e7d-8822dad71447';
const check = (url: string, id = operationId) =>
  canUseEditorialAudioSources({
    request: new Request('https://studio.test/api/v1/mainserver/news/99', {
      headers: { 'X-SVA-Content-Media-Save-Operation-Id': id },
    }),
    ctx: { user: { id: 'editor', instanceId: 'tenant' } } as AuthenticatedRequestContext,
    instanceId: 'tenant',
    targetType: 'news.article',
    targetId: '99',
    urls: [url],
  });

beforeEach(() => {
  state.authorize.mockReset().mockResolvedValue({ ok: true });
  state.asset.mockReset().mockResolvedValue(ready);
  state.claim.mockReset().mockResolvedValue(true);
});

describe('editorial audio sources', () => {
  it('checks the canonical public asset in the authorized instance', async () => {
    await expect(check(ownUrl)).resolves.toBe(true);
    expect(state.asset).toHaveBeenCalledWith('tenant', 'tenant/variants/asset/claim/original.mp3');
    expect(state.authorize).toHaveBeenCalledWith(expect.objectContaining({ action: 'media.read' }));
    expect(state.claim).toHaveBeenCalledExactlyOnceWith({
      instanceId: 'tenant',
      operationId,
      actorSubject: 'editor',
      targetType: 'news.article',
      targetId: '99',
      assetIds: ['asset'],
    });
  });

  it('rejects pasted managed audio without a prepared reference', async () => {
    await expect(check(ownUrl, '')).resolves.toBe(false);
    state.claim.mockResolvedValue(false);
    await expect(check(ownUrl)).resolves.toBe(false);
  });

  it.each([
    'https://cdn.test/media/another/variants/asset/claim/original.mp3',
    'https://storage.test/bucket/tenant/variants/asset/claim/original.mp3',
    `${ownUrl}?X-Amz-Signature=token`,
    'https://studio.test/api/v1/iam/media/asset/delivery',
    'https://foreign-cdn.test/tenant/variants/bc0836d8-0608-49db-8e7d-8822dad71447/bc0836d8-0608-49db-8e7d-8822dad71447/original.mp3',
    'https://foreign-cdn.test/tenant/%76ariants/bc0836d8-0608-49db-8e7d-8822dad71447/bc0836d8-0608-49db-8e7d-8822dad71447/original.mp3',
  ])('rejects a noncanonical managed source %s before lookup', async (url) => {
    await expect(check(url)).resolves.toBe(false);
    expect(state.asset).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { ...ready, visibility: 'protected' },
    { ...ready, technical: { scanStatus: 'pending' } },
    { ...ready, deletionPending: true },
  ])('rejects missing or ineligible managed assets', async (asset) => {
    state.asset.mockResolvedValue(asset);
    await expect(check(ownUrl)).resolves.toBe(false);
  });

  it('limits a provisional asset to the same actor and saving operation', async () => {
    state.asset.mockResolvedValue({
      ...ready,
      lifecycleStatus: 'provisional',
      provisionalOperationId: operationId,
      provisionalOwnerSubject: 'editor',
    });
    await expect(check(ownUrl)).resolves.toBe(true);
    await expect(check(ownUrl, 'another')).resolves.toBe(false);
    state.asset.mockResolvedValue({
      ...ready,
      lifecycleStatus: 'provisional',
      provisionalOperationId: operationId,
      provisionalOwnerSubject: 'another',
    });
    await expect(check(ownUrl)).resolves.toBe(false);
    expect(state.claim).toHaveBeenCalledOnce();
  });

  it('does not claim a write until all asset permissions pass', async () => {
    state.authorize.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    await expect(check(ownUrl)).resolves.toBe(false);
    expect(state.claim).not.toHaveBeenCalled();
  });

  it('validates direct URLs without loading an asset or requesting the URL', async () => {
    await expect(check('https://external.test/recording.mp3')).resolves.toBe(true);
    expect(state.asset).not.toHaveBeenCalled();
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.claim).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  ref: vi.fn(),
  bind: vi.fn(),
  mediaAuthorization: vi.fn(),
  media: { listReferencesByTarget: vi.fn(), replaceReferences: vi.fn(), getAssetById: vi.fn() },
}));
vi.mock('@sva/auth-runtime/server', () => ({
  authorizeMediaPrimitiveForUser: state.mediaAuthorization,
  loadExternalContentReferenceBySourceEntity: state.ref,
  bindExternalContentReference: state.bind,
  withExternalContentMutationLock: ({ execute }: { execute: () => Promise<unknown> }) => execute(),
  withMediaService: (_instance: string, execute: (media: typeof state.media) => unknown) =>
    execute(state.media),
}));
import {
  authorizeVoucherMedia,
  reconcileVoucherReferences,
  syncVoucherMedia,
} from './poi-route-vouchers.js';
import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
const ctx = { user: { instanceId: 'tenant', id: 'subject' } } as AuthenticatedRequestContext;
beforeEach(() => { vi.clearAllMocks(); });
describe('voucher Studio reference preservation', () => {
  it('rebinds stable Core history and moves media references in the same media transaction', async () => {
    state.ref
      .mockResolvedValueOnce({ id: 'ref', contentId: 'core' })
      .mockResolvedValueOnce(undefined);
    const reference = {
      id: 'media-ref',
      assetId: 'asset',
      targetType: 'vouchers.voucher',
      targetId: '2',
      role: 'gallery_item',
      sortOrder: 0,
    };
    state.media.listReferencesByTarget.mockImplementation(async (_tenant, _type, id) =>
      id === '2' ? [reference] : []
    );
    await reconcileVoucherReferences('tenant', [{ previousId: '2', id: '20' }]);
    expect(state.bind).toHaveBeenCalledWith({
      instanceId: 'tenant',
      referenceId: 'ref',
      sourceEntityId: '20',
    });
    expect(state.media.replaceReferences.mock.calls.map(([call]) => call)).toEqual([
      { instanceId: 'tenant', targetType: 'vouchers.voucher', targetId: '2', references: [] },
      {
        instanceId: 'tenant',
        targetType: 'vouchers.voucher',
        targetId: '20',
        references: [{ ...reference, targetId: '20' }],
      },
    ]);
  });
  it('does not overwrite an unrelated Core identity', async () => {
    state.ref
      .mockResolvedValueOnce({ id: 'ref', contentId: 'core' })
      .mockResolvedValueOnce({ id: 'other-ref', contentId: 'different' });
    await expect(
      reconcileVoucherReferences('tenant', [{ previousId: '2', id: '20' }])
    ).rejects.toThrow('voucher_identity_conflict');
    expect(state.bind).not.toHaveBeenCalled();
  });
  it('checks media permissions and readiness before provider writes', async () => {
    state.mediaAuthorization.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'forbidden',
    });
    expect((await authorizeVoucherMedia(ctx, [{ hostMediaAssetId: 'asset' }], []))?.status).toBe(
      403
    );
    expect(state.media.getAssetById).not.toHaveBeenCalled();
    state.mediaAuthorization.mockResolvedValue({ ok: true, actor: { instanceId: 'tenant' } });
    state.media.getAssetById.mockResolvedValue({
      visibility: 'protected',
      uploadStatus: 'processed',
      processingStatus: 'ready',
    });
    expect((await authorizeVoucherMedia(ctx, [{ hostMediaAssetId: 'asset' }], []))?.status).toBe(
      409
    );
  });
  it('retains unrecognized existing references when changing selected images', async () => {
    const retained = {
      id: 'unknown-ref',
      assetId: 'unknown',
      targetType: 'vouchers.voucher',
      targetId: '20',
      role: 'attachment',
    };
    state.media.listReferencesByTarget.mockResolvedValue([
      retained,
      { ...retained, assetId: 'removed', id: 'removed-ref' },
    ]);
    await syncVoucherMedia('tenant', '20', [{ hostMediaAssetId: 'new' }], ['removed']);
    expect(state.media.replaceReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        references: [retained, expect.objectContaining({ assetId: 'new', role: 'gallery_item' })],
      })
    );
  });
});

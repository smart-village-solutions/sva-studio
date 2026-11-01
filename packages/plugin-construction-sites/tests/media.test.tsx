import React from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConstructionSiteDefaults } from '../src/contract.js';
const host = vi.hoisted(() => ({
  assets: vi.fn(),
  asset: vi.fn(),
  delivery: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  options: null as unknown,
  usage: null as unknown,
  overlay: null as unknown,
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<object>()),
  usePluginTranslation: () => (key: string) => key,
  listHostMediaAssets: host.assets,
  getHostMediaAsset: host.asset,
  getHostMediaDelivery: host.delivery,
  uploadHostMediaFile: host.upload,
  updateHostMediaAsset: host.update,
}));
vi.mock('../src/construction-sites.access.js', () => ({
  useConstructionSiteAccess: () => ({
    permissionActions: ['media.read', 'media.reference.manage', 'media.create', 'media.update'],
  }),
}));
vi.mock('@sva/studio-ui-react', async (original) => ({
  ...(await original<object>()),
  useStudioMediaPickerOverlay: (options: unknown) => {
    host.options = options;
    return {
      open: false,
      searchValue: '',
      openLibrary: vi.fn(),
      openUpload: vi.fn(),
      close: vi.fn(),
      setSearchValue: vi.fn(),
      selectAsset: vi.fn(),
      uploadFile: vi.fn(),
      updateMetadataField: vi.fn(),
      goBackFromReview: vi.fn(),
      confirmSelection: vi.fn(),
      saveCentralMetadata: vi.fn(),
      applyImageEdit: vi.fn(),
      updateImageFocus: vi.fn(),
    };
  },
  StudioMediaPickerOverlay: (props: unknown) => {
    host.overlay = props;
    return null;
  },
  ContentMediaUsageBlock: (props: unknown) => {
    host.usage = props;
    return null;
  },
}));
import {
  useConstructionSiteMediaPicker,
  ConstructionSiteMediaOverlay,
} from '../src/construction-sites.media.js';
import { ConstructionSiteMediaFields } from '../src/construction-sites.form-media.js';
type PickerOptions = {
  loadAsset: (id: string) => Promise<unknown>;
  saveAssetMetadata: (id: string, metadata: object) => Promise<unknown>;
  canAcceptAsset: (asset: unknown) => boolean;
  onAccept: (asset: unknown) => Promise<void>;
};
beforeEach(() => {
  vi.clearAllMocks();
  host.assets.mockResolvedValue([]);
  host.asset.mockResolvedValue({
    id: 'asset-1',
    instanceId: 'tenant',
    storageKey: 'assets/image.png',
    mimeType: 'image/png',
    visibility: 'public',
    metadata: { title: 'Image', altText: 'Alt', description: 'Caption', copyright: 'Credit' },
  });
  host.delivery.mockResolvedValue({ isPublicUrl: true, deliveryUrl: 'https://cdn.test/image.png' });
});
afterEach(cleanup);
describe('construction site media integration', () => {
  it.each([
    ['image/png', 'image'],
    ['audio/mpeg', 'audio'],
    ['video/mp4', 'video'],
    ['application/pdf', 'attachement'],
  ])('keeps the selected %s file kind and metadata', async (mimeType, contentType) => {
    const select = vi.fn();
    renderHook(() => useConstructionSiteMediaPicker(select));
    const options = host.options as PickerOptions;
    expect(
      options.canAcceptAsset({ visibility: 'private', persistentUrl: 'https://cdn.test/image.png' })
    ).toBe(false);
    await act(async () =>
      options.onAccept({
        id: 'asset-1',
        mimeType,
        visibility: 'public',
        persistentUrl: 'https://cdn.test/image.png',
        metadata: { altText: 'Alt', description: 'Caption', copyright: 'Credit' },
      })
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        hostMediaAssetId: 'asset-1',
        contentType,
        sourceUrl: { url: 'https://cdn.test/image.png', description: 'Alt' },
        captionText: 'Caption',
        copyright: 'Credit',
      })
    );
  });
  it('loads current delivery and saves central metadata before refreshing the selection', async () => {
    const { result } = renderHook(() => useConstructionSiteMediaPicker(vi.fn()));
    const options = host.options as PickerOptions;
    await expect(options.loadAsset('asset-1')).resolves.toMatchObject({
      persistentUrl: 'https://cdn.test/image.png',
    });
    await act(async () => options.saveAssetMetadata('asset-1', { altText: 'Corrected' }));
    expect(host.update).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1', metadata: { altText: 'Corrected' } })
    );
    host.assets.mockRejectedValueOnce(new Error('network'));
    await act(async () => result.current.libraryStatus.onRetry());
    expect(result.current.libraryStatus.error).toBe(true);
    host.delivery.mockResolvedValueOnce({ isPublicUrl: false });
    await expect(options.loadAsset('asset-1')).resolves.toMatchObject({ persistentUrl: null });
  });
  it('uploads only once using a retained checkpoint and rejects unavailable delivery', async () => {
    host.upload.mockResolvedValue({ assetId: 'asset-1' });
    const select = vi.fn();
    renderHook(() => useConstructionSiteMediaPicker(select));
    const options = host.options as PickerOptions;
    const asset = {
      id: 'draft',
      previewUrl: null,
      localDraft: {
        id: 'draft',
        file: new File(['image'], 'image.png', { type: 'image/png' }),
        metadata: {},
      },
      metadata: { altText: 'Alt' },
    };
    await act(async () => options.onAccept(asset));
    expect(host.upload).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', mediaType: 'image' })
    );
    expect(select).toHaveBeenCalledTimes(1);
    await expect(
      options.onAccept({ id: 'bad', persistentUrl: null, metadata: {} })
    ).rejects.toThrow('media_delivery_unavailable');
  });
  it('keeps source indices and file order when usage rows change or are removed', () => {
    const draft = {
      ...createConstructionSiteDefaults('2026-11-01'),
      mediaContents: [
        {
          sourceIndex: 2,
          contentType: 'image' as const,
          hostMediaAssetId: 'asset-1',
          sourceUrl: { url: 'https://cdn.test/image.png', description: 'Alt' },
          captionText: 'Caption',
          copyright: 'Credit',
        },
      ],
    };
    const change = vi.fn();
    render(
      <ConstructionSiteMediaFields
        draft={draft}
        change={change}
        errors={[]}
        categories={[]}
        canPublish={false}
        disabled={false}
      />
    );
    const usage = host.usage as {
      usages: { uiId: string; persistentUrl: string }[];
      onChange: (next: unknown[]) => void;
      onAddManual: () => string;
    };
    act(() =>
      usage.onChange([
        {
          ...usage.usages[0],
          assetId: 'asset-1',
          persistentUrl: 'https://cdn.test/image.png',
          altText: 'Corrected',
          caption: 'Caption',
          credit: 'Credit',
        },
      ])
    );
    expect(change).toHaveBeenCalledWith('mediaContents', [
      expect.objectContaining({
        sourceIndex: 2,
        hostMediaAssetId: 'asset-1',
        sourceUrl: { url: 'https://cdn.test/image.png', description: 'Corrected' },
      }),
    ]);
    act(() => usage.onAddManual());
    expect(change).toHaveBeenLastCalledWith(
      'mediaContents',
      expect.arrayContaining([
        expect.objectContaining({ contentType: 'image', sourceUrl: { url: '', description: '' } }),
      ])
    );
    act(() => usage.onChange([]));
    expect(change).toHaveBeenLastCalledWith('mediaContents', []);
  });
  it('passes the current library and capability controls to the host overlay', () => {
    function Example() {
      const media = useConstructionSiteMediaPicker(vi.fn());
      return <ConstructionSiteMediaOverlay media={media} onAddManual={() => 'manual'} />;
    }
    render(<Example />);
    expect(host.overlay).toMatchObject({
      open: false,
      persistenceContext: 'content',
      visibleMetadataFields: ['altText', 'description', 'copyright'],
    });
  });
  it('handles empty optional metadata and permits only public persistent selections', async () => {
    host.asset.mockResolvedValue({
      id: 'empty',
      instanceId: 'tenant',
      storageKey: 'assets/empty',
      mimeType: 'image/png',
      visibility: 'public',
      metadata: {},
    });
    const select = vi.fn();
    renderHook(() => useConstructionSiteMediaPicker(select));
    const options = host.options as PickerOptions;
    await expect(options.loadAsset('empty')).resolves.toMatchObject({
      title: '',
      previewUrl: null,
      metadata: { title: '', altText: '', description: '', copyright: '', license: '' },
    });
    expect(
      options.canAcceptAsset({ visibility: 'public', persistentUrl: 'https://cdn.test/file.pdf' })
    ).toBe(true);
    expect(options.canAcceptAsset({ visibility: 'public', persistentUrl: null })).toBe(false);
    expect(options.canAcceptAsset({ localDraft: {} })).toBe(true);
    await act(async () =>
      options.onAccept({ id: 'empty', persistentUrl: 'https://cdn.test/file.pdf', metadata: {} })
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'attachement',
        captionText: '',
        copyright: '',
        sourceUrl: { url: 'https://cdn.test/file.pdf', description: '' },
      })
    );
  });
  it('disables library selections when the content is read-only', () => {
    renderHook(() => useConstructionSiteMediaPicker(vi.fn(), false));
    const options = host.options as PickerOptions;
    expect(
      options.canAcceptAsset({ visibility: 'public', persistentUrl: 'https://cdn.test/file.pdf' })
    ).toBe(false);
  });
  it('keeps manual URL entries unlinked and reports invalid persistent URLs', () => {
    const draft = {
      ...createConstructionSiteDefaults('2026-11-01'),
      mediaContents: [
        {
          contentType: 'image' as const,
          sourceUrl: { url: '', description: '' },
          captionText: '',
          copyright: '',
        },
      ],
    };
    const change = vi.fn();
    render(
      <ConstructionSiteMediaFields
        draft={draft}
        change={change}
        errors={['mediaContents.0.sourceUrl.url']}
        categories={[]}
        canPublish={false}
        disabled
      />
    );
    const props = host.usage as {
      usages: { uiId: string }[];
      errors: Record<string, string>;
      disabled: boolean;
      onChange: (rows: unknown[]) => void;
    };
    expect(props.disabled).toBe(true);
    expect(Object.values(props.errors)).toContain('messages.mediaUrlInvalid');
    act(() =>
      props.onChange([
        {
          uiId: 'new-manual',
          persistentUrl: 'https://cdn.test/manual.png',
          altText: '',
          caption: '',
          credit: '',
        },
      ])
    );
    expect(change).toHaveBeenCalledWith('mediaContents', [
      expect.objectContaining({
        contentType: 'image',
        hostMediaAssetId: undefined,
        sourceUrl: { url: 'https://cdn.test/manual.png', description: '' },
      }),
    ]);
  });
});

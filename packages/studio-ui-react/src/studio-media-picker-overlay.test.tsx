import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type StudioMediaPickerAssetDetail,
  useStudioMediaPickerOverlay,
} from './studio-media-picker-overlay.js';

const createAsset = (overrides?: Partial<StudioMediaPickerAssetDetail>): StudioMediaPickerAssetDetail => ({
  id: 'asset-1',
  title: 'Hero',
  fileName: 'hero.jpg',
  previewUrl: 'https://cdn.example.test/hero.jpg',
  mimeType: 'image/jpeg',
  visibility: 'public',
  metadata: {
    title: 'Hero',
    altText: 'Alt',
    description: 'Description',
    copyright: 'Copyright',
    license: 'CC-BY',
  },
  ...overrides,
});

describe('useStudioMediaPickerOverlay', () => {
  it('starts in upload mode, uploads, switches to review, and only accepts after metadata save', async () => {
    const asset = createAsset();
    const onAccept = vi.fn();
    const uploadAsset = vi.fn(async () => ({ assetId: asset.id }));
    const loadAsset = vi.fn(async () => asset);
    const saveAssetMetadata = vi.fn(async (_assetId: string, metadata) =>
      createAsset({
        metadata: {
          ...asset.metadata,
          ...metadata,
        },
        title: metadata.title ?? asset.title,
      })
    );

    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept,
        isSupportedUploadFile: (file) => file.type.startsWith('image/'),
        uploadAsset,
        loadAsset,
        saveAssetMetadata,
      })
    );

    act(() => {
      result.current.openUpload();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.mode).toBe('upload');

    await act(async () => {
      await result.current.uploadFile(new File(['binary'], 'hero.jpg', { type: 'image/jpeg' }));
    });

    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(loadAsset).toHaveBeenCalledWith(asset.id);
    expect(result.current.mode).toBe('review');
    expect(result.current.reviewAsset?.id).toBe(asset.id);
    expect(onAccept).not.toHaveBeenCalled();

    act(() => {
      result.current.updateMetadataField('title', 'Updated title');
      result.current.updateMetadataField('altText', '   ');
      result.current.updateMetadataField('description', '');
      result.current.updateMetadataField('copyright', '  ');
      result.current.updateMetadataField('license', '');
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(saveAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.objectContaining({
        title: 'Updated title',
        altText: null,
        description: null,
        copyright: null,
        license: null,
      })
    );
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        id: asset.id,
        metadata: expect.objectContaining({ title: 'Updated title' }),
      })
    );
    expect(result.current.open).toBe(false);
  });

  it('rejects unsupported files before starting the upload', async () => {
    const uploadAsset = vi.fn();

    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: (file) => file.type.startsWith('image/'),
        uploadAsset,
        loadAsset: vi.fn(),
        saveAssetMetadata: vi.fn(),
      })
    );

    act(() => {
      result.current.openUpload();
    });

    await act(async () => {
      await result.current.uploadFile(new File(['pdf'], 'manual.pdf', { type: 'application/pdf' }));
    });

    expect(uploadAsset).not.toHaveBeenCalled();
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.errorCode).toBe('unsupported_upload_type');
    expect(result.current.mode).toBe('upload');
  });

  it('returns from review to the originating mode without mutating selection', async () => {
    const asset = createAsset();
    const onAccept = vi.fn();

    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept,
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(),
        loadAsset: vi.fn(async () => asset),
        saveAssetMetadata: vi.fn(async () => asset),
      })
    );

    act(() => {
      result.current.openLibrary();
    });

    await act(async () => {
      await result.current.selectAsset({
        id: asset.id,
        title: asset.title,
        fileName: asset.fileName,
        previewUrl: asset.previewUrl,
        mimeType: asset.mimeType,
        visibility: asset.visibility,
      });
    });

    expect(result.current.mode).toBe('review');

    act(() => {
      result.current.goBackFromReview();
    });

    expect(result.current.mode).toBe('library');
    expect(onAccept).not.toHaveBeenCalled();
  });
});

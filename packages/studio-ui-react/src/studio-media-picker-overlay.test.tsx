import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  StudioMediaPickerOverlay,
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

const labels = {
  title: 'Medien',
  description: 'Overlay',
  modes: {
    library: 'Bibliothek',
    upload: 'Upload',
    review: 'Prüfen',
  },
  library: {
    searchLabel: 'Suche',
    empty: 'Leer',
    select: 'Auswählen',
  },
  upload: {
    regionLabel: 'Upload',
    title: 'Upload',
    description: 'Upload',
    browseAction: 'Datei auswählen',
    supportLabel: 'JPG',
  },
  review: {
    title: 'Prüfen',
    description: 'Prüfen',
  },
  fields: {
    title: 'Titel',
    altText: 'Alt',
    description: 'Beschreibung',
    copyright: 'Copyright',
    license: 'Lizenz',
  },
  actions: {
    cancel: 'Abbrechen',
    backToLibrary: 'Zurück zur Bibliothek',
    backToUpload: 'Zurück zum Upload',
    openMediaManagement: 'In Medienverwaltung öffnen',
    useMedia: 'Medium übernehmen',
  },
} as const;

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
    expect(result.current.uploadPhase).toBe('idle');
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

  it('keeps the review mode visible when loading an asset from the library fails', async () => {
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(),
        loadAsset: vi.fn(async () => {
          throw new Error('boom');
        }),
        saveAssetMetadata: vi.fn(),
      })
    );

    act(() => {
      result.current.openLibrary();
    });

    await act(async () => {
      await result.current.selectAsset({
        id: 'asset-1',
        title: 'Hero',
        fileName: 'hero.jpg',
        previewUrl: null,
        mimeType: 'image/jpeg',
        visibility: 'public',
      });
    });

    expect(result.current.mode).toBe('review');
    expect(result.current.errorCode).toBe('asset_load_failed');
    expect(result.current.reviewAsset).toBeNull();
  });

  it('accepts an unchanged review asset without requiring a metadata save', async () => {
    const asset = createAsset();
    const onAccept = vi.fn();
    const saveAssetMetadata = vi.fn();

    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept,
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(),
        loadAsset: vi.fn(async () => asset),
        saveAssetMetadata,
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

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(saveAssetMetadata).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith(asset);
    expect(result.current.open).toBe(false);
  });

  it('disables review actions and mode switches while the overlay is busy', () => {
    const onChangeMode = vi.fn();
    const onBackFromReview = vi.fn();
    const onClose = vi.fn();
    const onOpenMediaManagement = vi.fn();
    const reviewAsset = createAsset();

    render(
      <StudioMediaPickerOverlay
        assets={[]}
        isLoadingReviewAsset={false}
        isSavingReviewAsset
        labels={labels}
        metadataDraft={reviewAsset.metadata}
        mode="review"
        onBackFromReview={onBackFromReview}
        onChangeMode={onChangeMode}
        onClose={onClose}
        onConfirmSelection={vi.fn()}
        onMetadataChange={vi.fn()}
        onOpenMediaManagement={onOpenMediaManagement}
        onSearchValueChange={vi.fn()}
        onSelectAsset={vi.fn()}
        onUploadFile={vi.fn()}
        open
        reviewAsset={reviewAsset}
        reviewSource="upload"
        searchValue=""
        uploadPhase="idle"
        feedbackMessage={null}
      />
    );

    const libraryTab = screen.getByRole('button', { name: labels.modes.library });
    const uploadTab = screen.getByRole('button', { name: labels.modes.upload });
    const backButton = screen.getByRole('button', { name: labels.actions.backToUpload });
    const openManagementButton = screen.getByRole('button', { name: labels.actions.openMediaManagement });
    const cancelButton = screen.getByRole('button', { name: labels.actions.cancel });

    expect(libraryTab.getAttribute('disabled')).not.toBeNull();
    expect(uploadTab.getAttribute('disabled')).not.toBeNull();
    expect(backButton.getAttribute('disabled')).not.toBeNull();
    expect(openManagementButton.getAttribute('disabled')).not.toBeNull();
    expect(cancelButton.getAttribute('disabled')).not.toBeNull();

    fireEvent.click(cancelButton);
    fireEvent.click(backButton);
    fireEvent.click(openManagementButton);

    expect(onChangeMode).not.toHaveBeenCalled();
    expect(onBackFromReview).not.toHaveBeenCalled();
    expect(onOpenMediaManagement).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders feedback in library mode so asset load errors stay visible', () => {
    render(
      <StudioMediaPickerOverlay
        assets={[]}
        feedbackMessage="Asset konnte nicht geladen werden"
        feedbackTone="error"
        labels={labels}
        metadataDraft={createAsset().metadata}
        mode="library"
        onBackFromReview={vi.fn()}
        onChangeMode={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        onMetadataChange={vi.fn()}
        onSearchValueChange={vi.fn()}
        onSelectAsset={vi.fn()}
        onUploadFile={vi.fn()}
        open
        reviewAsset={null}
        reviewSource="library"
        searchValue=""
        uploadPhase="idle"
      />
    );

    expect(screen.getByRole('status').textContent).toContain('Asset konnte nicht geladen werden');
  });

  it('uses the edited alt text for the review preview image', () => {
    const reviewAsset = createAsset();

    render(
      <StudioMediaPickerOverlay
        assets={[]}
        feedbackMessage="Metadaten prüfen"
        labels={labels}
        metadataDraft={{
          ...reviewAsset.metadata,
          title: 'Aktualisierter Titel',
          altText: 'Aktualisierter Alternativtext',
        }}
        mode="review"
        onBackFromReview={vi.fn()}
        onChangeMode={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        onMetadataChange={vi.fn()}
        onOpenMediaManagement={vi.fn()}
        onSearchValueChange={vi.fn()}
        onSelectAsset={vi.fn()}
        onUploadFile={vi.fn()}
        open
        reviewAsset={reviewAsset}
        reviewSource="upload"
        searchValue=""
        uploadPhase="idle"
      />
    );

    expect(screen.getByRole('img', { name: 'Aktualisierter Alternativtext' })).toBeTruthy();
  });
});

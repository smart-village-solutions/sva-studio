import { createMediaEditingDocument } from '@sva/media';
import * as React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createLocalStudioMediaPickerAsset,
  StudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
  useStudioMediaPickerOverlay,
} from './studio-media-picker-overlay.js';

const createAsset = (
  overrides?: Partial<StudioMediaPickerAssetDetail>
): StudioMediaPickerAssetDetail => ({
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
  it('limits review metadata fields while retaining the read-only state', () => {
    const asset = createAsset();
    render(
      <StudioMediaPickerOverlay
        assets={[]}
        isMetadataEditable={false}
        labels={{
          title: 'Media',
          description: 'Select media',
          modes: {
            library: 'Add from library',
            upload: 'Upload media',
            manual: 'Add by link',
            review: 'Review',
          },
          library: { searchLabel: 'Search', empty: 'Empty', select: 'Select' },
          upload: {
            regionLabel: 'Upload region',
            title: 'Upload',
            description: 'Upload an image',
            browseAction: 'Browse',
            supportLabel: 'Images only',
          },
          review: { title: 'Review', description: 'Review image' },
          fields: {
            title: 'Title',
            altText: 'Alternative text',
            description: 'Description field',
            copyright: 'Copyright',
            license: 'License',
          },
          actions: {
            cancel: 'Cancel',
            backToLibrary: 'Back',
            backToUpload: 'Back to upload',
            openMediaManagement: 'Open media',
            useMedia: 'Use image',
          },
        }}
        metadataDraft={asset.metadata}
        mode="review"
        onBackFromReview={vi.fn()}
        onAddManual={vi.fn()}
        onChangeMode={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        onMetadataChange={vi.fn()}
        onSearchValueChange={vi.fn()}
        onSelectAsset={vi.fn()}
        onUploadFile={vi.fn()}
        open
        reviewAsset={asset}
        reviewSource="library"
        searchValue=""
        uploadPhase="idle"
        visibleMetadataFields={['altText']}
      />
    );

    expect((screen.getByLabelText('Alternative text') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByLabelText('Description field')).toBeNull();
    expect(screen.queryByLabelText('Copyright')).toBeNull();
    expect(screen.queryByLabelText('License')).toBeNull();
  });

  it('presents upload, library and link actions in the requested hierarchy', async () => {
    const onAddManual = vi.fn(() => 'manual-1');
    const onChangeMode = vi.fn();
    const onClose = vi.fn();
    const asset = createAsset();
    const Harness = ({
      canUpload = true,
      uploadPhase = 'idle',
    }: Readonly<{
      canUpload?: boolean;
      uploadPhase?: 'idle' | 'uploading';
    }>) => {
      const [open, setOpen] = React.useState(true);
      const [mode, setMode] = React.useState<'library' | 'upload'>('upload');
      return (
        <>
          <StudioMediaPickerOverlay
            assets={[]}
            canUpload={canUpload}
            labels={{
              title: 'Medium hinzufügen',
              description: 'Medium auswählen',
              modes: {
                upload: 'Medium hochladen',
                library: 'Medium aus der Bibliothek hinzufügen',
                manual: 'Medium per Link hinzufügen',
                review: 'Prüfen',
              },
              library: { searchLabel: 'Suchen', empty: 'Leer', select: 'Auswählen' },
              upload: {
                regionLabel: 'Upload',
                title: 'Upload',
                description: 'Upload',
                browseAction: 'Datei auswählen',
                supportLabel: 'Nur Bilder',
              },
              review: { title: 'Prüfen', description: 'Prüfen' },
              fields: {
                title: 'Titel',
                altText: 'Alternativtext',
                description: 'Beschreibung',
                copyright: 'Copyright',
                license: 'Lizenz',
              },
              actions: {
                cancel: 'Abbrechen',
                backToLibrary: 'Zurück',
                backToUpload: 'Zurück',
                openMediaManagement: 'Öffnen',
                useMedia: 'Übernehmen',
              },
            }}
            metadataDraft={asset.metadata}
            mode={mode}
            onAddManual={onAddManual}
            onBackFromReview={vi.fn()}
            onChangeMode={(nextMode) => {
              onChangeMode(nextMode);
              setMode(nextMode);
            }}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            onConfirmSelection={vi.fn()}
            onMetadataChange={vi.fn()}
            onSearchValueChange={vi.fn()}
            onSelectAsset={vi.fn()}
            onUploadFile={vi.fn()}
            open={open}
            reviewAsset={null}
            reviewSource="upload"
            searchValue=""
            uploadPhase={uploadPhase}
          />
          <input id="content-media-manual-1-url" aria-label="Manuelle URL" />
        </>
      );
    };
    render(<Harness />);

    const uploadAction = screen.getByRole('button', { name: 'Medium hochladen' });
    const libraryAction = screen.getByRole('button', {
      name: 'Medium aus der Bibliothek hinzufügen',
    });
    expect(uploadAction.getAttribute('aria-pressed')).toBe('true');
    expect(uploadAction.className).toContain('bg-action-primary');
    expect(libraryAction.className).toContain('bg-action-secondary');
    fireEvent.click(libraryAction);
    expect(onChangeMode).toHaveBeenCalledWith('library');
    expect(uploadAction.className).toContain('bg-action-secondary');
    expect(libraryAction.className).toContain('bg-action-primary');
    fireEvent.click(screen.getByRole('button', { name: 'Medium per Link hinzufügen' }));
    expect(onAddManual).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('content-media-manual-1-url'))
    );

    render(<Harness canUpload={false} />);
    expect(
      (screen.getByRole('button', { name: 'Medium hochladen' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.queryByLabelText('Upload')).toBeNull();
    expect(screen.getByLabelText('Suchen')).toBeTruthy();

    render(<Harness uploadPhase="uploading" />);
    const manualAction = screen.getByRole('button', {
      name: 'Medium per Link hinzufügen',
    });
    expect((manualAction as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(manualAction);
    expect(onAddManual).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('accepts content-specific metadata without writing central metadata', async () => {
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
    });

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(saveAssetMetadata).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        id: asset.id,
        metadata: expect.objectContaining({ title: 'Updated title' }),
      })
    );
    expect(result.current.open).toBe(false);
  });

  it('keeps non-editable metadata untouched in the content selection', async () => {
    const asset = createAsset({
      title: 'hero.jpg',
      metadata: {
        title: '',
        altText: 'Old alt text',
        description: 'Hidden description',
        copyright: 'Hidden copyright',
        license: 'Hidden license',
      },
    });
    const saveAssetMetadata = vi.fn(async (_assetId: string, metadata) =>
      createAsset({ metadata: { ...asset.metadata, ...metadata } })
    );
    const onAccept = vi.fn();
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        editableMetadataFields: ['altText'],
        onAccept,
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(),
        loadAsset: vi.fn(async () => asset),
        saveAssetMetadata,
      })
    );

    act(() => result.current.openLibrary());
    await act(async () => result.current.selectAsset(asset));
    act(() => result.current.updateMetadataField('altText', 'Updated alt text'));
    await act(async () => result.current.confirmSelection());

    expect(saveAssetMetadata).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          altText: 'Updated alt text',
          description: 'Hidden description',
        }),
        centralMetadata: asset.metadata,
      })
    );
  });

  it('saves central metadata only through the explicit action while preserving the content draft', async () => {
    const asset = createAsset();
    const onAccept = vi.fn();
    const saveAssetMetadata = vi.fn(async () =>
      createAsset({ metadata: { ...asset.metadata, altText: 'Zentral neu' } })
    );
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept,
        isSupportedUploadFile: () => true,
        loadAsset: async () => asset,
        saveAssetMetadata,
      })
    );
    act(() => result.current.openLibrary());
    await act(async () => result.current.selectAsset(asset));
    act(() => result.current.updateMetadataField('altText', 'Nur für diesen Inhalt'));
    await act(async () =>
      expect(
        await result.current.saveCentralMetadata({ altText: 'Zentral neu', tags: ['Park'] })
      ).toBe(true)
    );
    expect(saveAssetMetadata).toHaveBeenCalledWith(asset.id, {
      altText: 'Zentral neu',
      tags: ['Park'],
    });
    expect(result.current.metadataDraft.altText).toBe('Nur für diesen Inhalt');
    expect(result.current.open).toBe(true);
    expect(onAccept).not.toHaveBeenCalled();
    await act(async () => result.current.confirmSelection());
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ altText: 'Nur für diesen Inhalt' }),
        centralMetadata: expect.objectContaining({ altText: 'Zentral neu' }),
      })
    );
  });

  it.each(['library', 'settings', 'content'] as const)(
    'keeps explicitly saved local metadata when accepting in the %s context',
    async (persistenceContext) => {
      const localMetadata = { title: 'Neue Kopie', altText: 'Neuer Alttext', tags: ['Park'] };
      const asset = createAsset({
        localDraft: {
          id: 'local-copy',
          file: new File(['copy'], 'copy.png', { type: 'image/png' }),
          metadata: createAsset().metadata,
        },
      });
      const onAccept = vi.fn();
      const saveAssetMetadata = vi.fn();
      const { result } = renderHook(() =>
        useStudioMediaPickerOverlay({
          persistenceContext,
          onAccept,
          isSupportedUploadFile: () => true,
          loadAsset: async () => asset,
          saveAssetMetadata,
        })
      );
      act(() => result.current.openAsset(asset));
      act(() => result.current.updateMetadataField('altText', 'Eigener Inhaltsalttext'));
      await act(async () => {
        expect(await result.current.saveCentralMetadata(localMetadata)).toBe(true);
      });
      await act(async () => result.current.confirmSelection());
      expect(saveAssetMetadata).not.toHaveBeenCalled();
      expect(onAccept).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ...localMetadata,
            title: persistenceContext === 'content' ? asset.metadata.title : localMetadata.title,
            altText:
              persistenceContext === 'content' ? 'Eigener Inhaltsalttext' : localMetadata.altText,
          }),
          localDraft: expect.objectContaining({ metadata: expect.objectContaining(localMetadata) }),
        })
      );
    }
  );

  it('keeps central and content drafts when explicit central saving fails', async () => {
    const asset = createAsset();
    const saveAssetMetadata = vi.fn(async () => {
      throw new Error('failure');
    });
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        loadAsset: async () => asset,
        saveAssetMetadata,
      })
    );
    act(() => result.current.openLibrary());
    await act(async () => result.current.selectAsset(asset));
    act(() => result.current.updateMetadataField('altText', 'Eigener Entwurf'));
    await act(async () =>
      expect(await result.current.saveCentralMetadata({ title: 'Neuer Titel' })).toBe(false)
    );
    expect(result.current.metadataDraft.altText).toBe('Eigener Entwurf');
    expect(result.current.errorCode).toBe('metadata_save_failed');
    expect(result.current.open).toBe(true);
  });

  it('preserves the upload preview url until the host asset exposes one itself', async () => {
    const asset = createAsset({ previewUrl: '' });
    const onAccept = vi.fn();

    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept,
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(async () => ({
          assetId: asset.id,
          previewUrl: 'https://cdn.example.test/uploaded.jpg',
        })),
        loadAsset: vi.fn(async () => asset),
        saveAssetMetadata: vi.fn(async () => ({ ...asset, previewUrl: '' })),
      })
    );

    act(() => {
      result.current.openUpload();
    });

    await act(async () => {
      await result.current.uploadFile(new File(['binary'], 'hero.jpg', { type: 'image/jpeg' }));
    });

    expect(result.current.reviewAsset?.previewUrl).toBe('https://cdn.example.test/uploaded.jpg');

    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        previewUrl: 'https://cdn.example.test/uploaded.jpg',
      })
    );
  });

  it('normalizes editable metadata before accepting a local draft', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-trim');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const onAccept = vi.fn();
    const { result, unmount } = renderHook(() =>
      useStudioMediaPickerOverlay({
        editableMetadataFields: ['altText'],
        onAccept,
        isSupportedUploadFile: () => true,
        createLocalAsset: createLocalStudioMediaPickerAsset,
        loadAsset: vi.fn(),
        saveAssetMetadata: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.uploadFile(new File(['binary'], 'hero.jpg', { type: 'image/jpeg' }));
    });
    act(() => result.current.updateMetadataField('altText', '  Local alt text  '));
    await act(async () => result.current.confirmSelection());

    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ altText: 'Local alt text' }) })
    );
    unmount();
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it('revokes an unaccepted local preview exactly once when the overlay closes', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-close');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        createLocalAsset: createLocalStudioMediaPickerAsset,
        loadAsset: vi.fn(),
        saveAssetMetadata: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.uploadFile(new File(['binary'], 'hero.jpg', { type: 'image/jpeg' }));
    });
    act(() => result.current.close());
    unmount();

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:local-close');
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it('retains a local draft when replacement fails and releases it only after successful replacement', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:replacement');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const asset = createAsset();
    const loadAsset = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(asset);
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        createLocalAsset: createLocalStudioMediaPickerAsset,
        loadAsset,
        saveAssetMetadata: vi.fn(),
      })
    );
    await act(async () =>
      result.current.uploadFile(new File(['local'], 'local.jpg', { type: 'image/jpeg' }))
    );
    act(() => result.current.updateMetadataField('altText', 'Eigener Entwurf'));
    const local = result.current.reviewAsset;
    await act(async () => result.current.selectAsset(asset));
    expect(result.current.reviewAsset).toBe(local);
    expect(result.current.metadataDraft.altText).toBe('Eigener Entwurf');
    expect(result.current.errorCode).toBe('asset_load_failed');
    expect(revoke).not.toHaveBeenCalled();
    await act(async () => result.current.selectAsset(asset));
    expect(result.current.reviewAsset?.id).toBe(asset.id);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:replacement');
    create.mockRestore();
    revoke.mockRestore();
  });

  it('keeps the close action stable while no local preview changes', () => {
    const { result, rerender } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(),
        loadAsset: vi.fn(),
        saveAssetMetadata: vi.fn(),
      })
    );
    const initialClose = result.current.close;

    act(() => result.current.openLibrary());
    rerender();

    expect(result.current.close).toBe(initialClose);
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

  it('does not report an upload as successful when loading its review asset fails', async () => {
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        uploadAsset: vi.fn(async () => ({ assetId: 'asset-1' })),
        loadAsset: vi.fn(async () => {
          throw new Error('asset unavailable');
        }),
        saveAssetMetadata: vi.fn(),
      })
    );

    act(() => {
      result.current.openUpload();
    });

    await act(async () => {
      await result.current.uploadFile(new File(['binary'], 'hero.jpg', { type: 'image/jpeg' }));
    });

    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.errorCode).toBe('asset_load_failed');
    expect(result.current.mode).toBe('review');
  });

  it('accepts unchanged selectable assets without requiring metadata update permission', async () => {
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
        canAcceptAsset: () => true,
      })
    );

    act(() => {
      result.current.openLibrary();
    });
    await act(async () => {
      await result.current.selectAsset(asset);
    });
    await act(async () => {
      await result.current.confirmSelection();
    });

    expect(saveAssetMetadata).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith(asset);
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
  it('keeps an edited library image local and preserves content overrides, creation metadata and focus until acceptance', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:edited');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const asset = createAsset({ metadata: { ...createAsset().metadata, tags: ['Stadt'] } });
    const accept = vi.fn();
    const upload = vi.fn();
    const save = vi.fn();
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: accept,
        isSupportedUploadFile: () => true,
        uploadAsset: upload,
        loadAsset: async () => asset,
        saveAssetMetadata: save,
      })
    );
    await act(async () => {
      result.current.openLibrary();
      await result.current.selectAsset(asset);
    });
    act(() => result.current.updateMetadataField('altText', 'Mein Inhalt'));
    const file = new File(['rendered'], 'copy.png', { type: 'image/png' });
    const editing = {
      sourceAssetId: 'source-root',
      document: createMediaEditingDocument({ annotations: {} }),
    };
    act(() => result.current.applyImageEdit({ file, editing }));
    act(() => result.current.updateImageFocus({ x: 0.2, y: 0.8 }));
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    expect(result.current.reviewAsset?.id).not.toBe(asset.id);
    expect(asset.metadata.altText).toBe('Alt');
    await act(async () => result.current.confirmSelection());
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ altText: 'Mein Inhalt' }),
        centralMetadata: expect.objectContaining({ altText: 'Alt' }),
        localDraft: expect.objectContaining({
          file,
          editing,
          metadata: expect.objectContaining({
            altText: 'Alt',
            tags: ['Stadt'],
            focusPoint: { x: 0.2, y: 0.8 },
          }),
        }),
      })
    );
    expect(revoke).not.toHaveBeenCalled();
    create.mockRestore();
    revoke.mockRestore();
  });

  it('retains the local foundation and adds the edited title only once across repeated edits', async () => {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:local')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: vi.fn(),
        isSupportedUploadFile: () => true,
        createLocalAsset: createLocalStudioMediaPickerAsset,
        loadAsset: vi.fn(),
        saveAssetMetadata: vi.fn(),
      })
    );
    const sourceFile = new File(['original'], 'source.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.uploadFile(sourceFile));
    const document = createMediaEditingDocument({ annotations: {} });
    act(() =>
      result.current.applyImageEdit({
        file: new File(['one'], 'one.png'),
        editing: { sourceFile, document },
      })
    );
    const title = result.current.reviewAsset?.title;
    act(() =>
      result.current.applyImageEdit({
        file: new File(['two'], 'two.png'),
        editing: { sourceFile, document },
      })
    );
    expect(result.current.reviewAsset?.title).toBe(title);
    expect(result.current.reviewAsset?.localDraft?.editing?.sourceFile).toBe(sourceFile);
    expect(revoke).toHaveBeenNthCalledWith(1, 'blob:local');
    expect(revoke).toHaveBeenNthCalledWith(2, 'blob:first');
    act(() => result.current.close());
    expect(revoke).toHaveBeenNthCalledWith(3, 'blob:second');
    create.mockRestore();
    revoke.mockRestore();
  });
  it('waits for immediate completion before closing and preserves the draft if saving fails', async () => {
    const asset = createAsset();
    let finish: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const accept = vi.fn(() => pending);
    const { result } = renderHook(() =>
      useStudioMediaPickerOverlay({
        onAccept: accept,
        isSupportedUploadFile: () => true,
        loadAsset: async () => asset,
        saveAssetMetadata: vi.fn(),
      })
    );
    act(() => result.current.openAsset(asset));
    let completion: Promise<void> | undefined;
    await act(async () => {
      completion = result.current.confirmSelection();
    });
    expect(result.current.isSavingReviewAsset).toBe(true);
    expect(result.current.open).toBe(true);
    await act(async () => {
      finish?.();
      await completion;
    });
    expect(result.current.open).toBe(false);
    accept.mockRejectedValueOnce(new Error('upload unavailable'));
    act(() => {
      result.current.openAsset(asset);
      result.current.updateMetadataField('title', 'Mein Entwurf');
    });
    await act(async () => result.current.confirmSelection());
    expect(result.current.open).toBe(true);
    expect(result.current.metadataDraft.title).toBe('Mein Entwurf');
    expect(result.current.errorCode).toBe('metadata_save_failed');
    expect(result.current.isSavingReviewAsset).toBe(false);
  });
});

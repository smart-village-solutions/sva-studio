import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaLibraryPage } from './-media-library-page';

const useMediaLibraryMock = vi.fn();
const useSingleFileMediaUploadMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly to: string;
    readonly params?: Record<string, string>;
  }) => {
    const href = typeof params?.mediaId === 'string' ? to.replace('$mediaId', params.mediaId) : to;
    return (
      <a href={href} {...props}>
      {children}
      </a>
    );
  },
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-media', () => ({
  useMediaLibrary: (...args: unknown[]) => useMediaLibraryMock(...args),
  useSingleFileMediaUpload: (...args: unknown[]) => useSingleFileMediaUploadMock(...args),
}));

describe('MediaLibraryPage', () => {
  const uploadFileMock = vi.fn();

  beforeEach(() => {
    useMediaLibraryMock.mockReset();
    useSingleFileMediaUploadMock.mockReset();
    uploadFileMock.mockReset();
    navigateMock.mockReset();
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-ready',
          instanceId: 'instance-1',
          storageKey: 'media/asset-ready',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 2_048_000,
          updatedAt: '2026-06-12T08:30:00.000Z',
          previewUrl: 'https://cdn.example.test/media/asset-ready.jpg',
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Stadtfest 2024 - Hauptbühne',
            altText: 'Hauptbühne bei Abendlicht',
          },
          technical: {},
        },
        {
          id: 'asset-blocked',
          instanceId: 'instance-1',
          storageKey: 'media/asset-blocked',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 512_000,
          visibility: 'protected',
          uploadStatus: 'blocked',
          processingStatus: 'failed',
          metadata: {
            title: 'Blockierte Medienprobe',
            altText: 'Verarbeitung fehlgeschlagen',
          },
          technical: {},
        },
        {
          id: 'asset-new',
          instanceId: 'instance-1',
          storageKey: 'media/asset-new',
          mediaType: 'image',
          mimeType: 'image/webp',
          byteSize: 256_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            altText: 'Titel fehlt noch',
          },
          technical: {},
        },
        {
          id: 'asset-unused',
          instanceId: 'instance-1',
          storageKey: 'media/asset-unused',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 128_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Ungenutztes Bühnenbanner',
            altText: 'Banner ohne Referenzen',
          },
          technical: {},
        },
        {
          id: 'asset-pdf',
          instanceId: 'instance-1',
          storageKey: 'media/asset-pdf',
          mediaType: 'image',
          mimeType: 'application/pdf',
          byteSize: 98_304,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Veranstaltungsflyer 2024',
            altText: 'Programmflyer',
          },
          technical: {},
        },
        {
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/uploads/2026/06/manual.pdf',
          fileName: 'manual.pdf',
          folderPath: 'uploads/2026/06',
          relativePath: 'uploads/2026/06/manual.pdf',
          byteSize: 64_000,
          updatedAt: '2026-06-11T10:00:00.000Z',
          lastModified: '2026-06-11T10:00:00.000Z',
          previewUrl: null,
        },
        {
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
          fileName: 'mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
          folderPath: 'cms_uploads',
          relativePath: 'cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
          byteSize: 64_000,
          updatedAt: '2026-06-11T11:00:00.000Z',
          lastModified: '2026-06-11T11:00:00.000Z',
          previewUrl:
            'https://fileserver.smart-village.app/de-musterhausen/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
        },
      ],
      usageByAssetId: {
        'asset-ready': 3,
        'asset-blocked': 1,
        'asset-new': 2,
        'asset-unused': 0,
        'asset-pdf': 4,
        'instance-1/uploads/2026/06/manual.pdf': null,
        'instance-1/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg': null,
      },
      usageStatusByAssetId: {
        'asset-ready': 'ready',
        'asset-blocked': 'ready',
        'asset-new': 'ready',
        'asset-unused': 'ready',
        'asset-pdf': 'ready',
        'instance-1/uploads/2026/06/manual.pdf': 'unavailable',
        'instance-1/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg': 'unavailable',
      },
      isUsageLoading: false,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 7,
      refetch: vi.fn(),
    });
    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'idle',
      error: null,
      assetId: null,
      uploadSessionId: null,
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the intake shelf above the asset grid', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByRole('heading', { name: 'Medienbibliothek' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dateien hochladen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dateien auswählen' })).toBeTruthy();
    expect(screen.getByText('Unterstützt:')).toBeTruthy();
    expect(screen.queryByText('Blockiert')).toBeNull();
    expect(screen.queryByText('Neu')).toBeNull();
    expect(screen.queryByText('Ungenutzt')).toBeNull();
  });

  it('opens the hidden file input from the intake CTA and forwards the selected file into the upload hook', () => {
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    uploadFileMock.mockResolvedValue(null);

    render(<MediaLibraryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }));
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    const file = new File(['binary'], 'hero.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [file] },
    });

    expect(uploadFileMock).toHaveBeenCalledWith(file);
  });

  it('accepts a supported image file via drag and drop', () => {
    render(<MediaLibraryPage />);

    const file = new File(['binary'], 'hero.jpg', { type: 'image/jpeg' });
    const shelf = screen.getByTestId('media-intake-shelf');

    fireEvent.dragEnter(shelf, {
      dataTransfer: {
        files: [file],
        dropEffect: 'none',
      },
    });
    expect(shelf.className).toContain('border-primary/50');

    fireEvent.drop(shelf, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(uploadFileMock).toHaveBeenCalledWith(file);
  });

  it('ignores unsupported files dropped onto the intake shelf', () => {
    render(<MediaLibraryPage />);

    const file = new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' });
    fireEvent.drop(screen.getByTestId('media-intake-shelf'), {
      dataTransfer: {
        files: [file],
      },
    });

    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it('renders upload progress and error states inside the intake shelf', () => {
    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'uploading',
      error: null,
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });

    const { rerender } = render(<MediaLibraryPage />);
    expect(screen.getByText('Datei wird hochgeladen …')).toBeTruthy();

    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'finalizing',
      error: null,
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });
    rerender(<MediaLibraryPage />);
    expect(screen.getByText('Upload wird abgeschlossen …')).toBeTruthy();

    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'error',
      error: { code: 'database_unavailable' },
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });
    rerender(<MediaLibraryPage />);
    expect(
      screen.getByText('Die Mediendaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.')
    ).toBeTruthy();
  });

  it('navigates to the media detail page after a successful upload', async () => {
    uploadFileMock.mockResolvedValue({ assetId: 'asset-uploaded' });

    render(<MediaLibraryPage />);

    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })] },
    });

    await Promise.resolve();

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/media/$mediaId',
      params: { mediaId: 'asset-uploaded' },
    });
  });

  it('renders asset cards with usage and status hints instead of the raw table', () => {
    render(<MediaLibraryPage />);

    const readyLink = screen.getByRole('link', { name: /Stadtfest 2024 - Hauptbühne/i });

    expect(screen.getByText('3 Verwendungen')).toBeTruthy();
    expect(screen.getByText('1 Verwendung')).toBeTruthy();
    expect(screen.getByText('Geändert am 12.06.2026')).toBeTruthy();
    expect(screen.getAllByText('Geändert am 11.06.2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bereit').length).toBeGreaterThan(0);
    expect(readyLink.getAttribute('href')).toBe('/admin/media/asset-ready');
    expect(readyLink.className).toContain('h-full');
    expect(readyLink.firstElementChild?.className).toContain('h-full');
    expect(screen.getByRole('img', { name: 'Stadtfest 2024 - Hauptbühne' }).getAttribute('src')).toBe(
      'https://cdn.example.test/media/asset-ready.jpg'
    );
  });

  it('renders non-image assets with a dedicated fallback card pattern', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByText('Veranstaltungsflyer 2024')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('renders unregistered bucket files flat with folder info and without an unregistered badge', () => {
    render(<MediaLibraryPage />);

    const manualLink = screen.getByRole('link', { name: /manual\.pdf/i });
    expect(manualLink).toBeTruthy();
    expect(screen.getByText('uploads/2026/06')).toBeTruthy();
    expect(screen.queryByText('Nicht registriert')).toBeNull();
    expect(manualLink.getAttribute('href')).toContain('/admin/media/bucket:');
  });

  it('renders derived image previews for unregistered bucket images', () => {
    render(<MediaLibraryPage />);

    const preview = screen.getByRole('img', {
      name: 'mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
    });

    expect(preview.getAttribute('src')).toBe(
      'https://fileserver.smart-village.app/de-musterhausen/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg'
    );
  });

  it('renders the empty state when no library assets are available', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [],
      usageByAssetId: {},
      usageStatusByAssetId: {},
      isUsageLoading: false,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 0,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(
      screen.getByText(
        'Noch keine Medien vorhanden. Initialisieren Sie den ersten Upload, um die Bibliothek zu füllen.'
      )
    ).toBeTruthy();
  });

  it('renders the library load error when the hook reports a failure', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [],
      usageByAssetId: {},
      usageStatusByAssetId: {},
      isUsageLoading: false,
      isLoading: false,
      error: { code: 'database_unavailable' },
      page: 1,
      pageSize: 36,
      total: 0,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(
      screen.getByText(
        'Die Mediendaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.'
      )
    ).toBeTruthy();
  });

  it('renders unknown usage counts without treating the asset as unused', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-unknown',
          instanceId: 'instance-1',
          storageKey: 'media/asset-unknown',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 512_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Unklare Nutzungsdaten',
            altText: 'Asset mit fehlender Usage-Anreicherung',
          },
          technical: {},
        },
      ],
      usageByAssetId: {
        'asset-unknown': null,
      },
      usageStatusByAssetId: {
        'asset-unknown': 'unavailable',
      },
      isUsageLoading: false,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 1,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(screen.getByText('Nutzung nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('bereit')).toBeTruthy();
  });

  it('renders the loading usage label while enrichment is still in flight', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-loading',
          instanceId: 'instance-1',
          storageKey: 'media/asset-loading',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 512_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Noch ladende Nutzungsdaten',
            altText: 'Asset mit laufender Usage-Anreicherung',
          },
          technical: {},
        },
      ],
      usageByAssetId: {
        'asset-loading': null,
      },
      usageStatusByAssetId: {
        'asset-loading': 'loading',
      },
      isUsageLoading: true,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 1,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(screen.getByText('Nutzung wird geladen')).toBeTruthy();
  });

  it('renders unavailable usage for one asset while another asset is still loading', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-unavailable',
          instanceId: 'instance-1',
          storageKey: 'media/asset-unavailable',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 256_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Asset ohne Usage-Antwort',
            altText: 'Fehlgeschlagene Enrichment-Antwort',
          },
          technical: {},
        },
        {
          id: 'asset-pending',
          instanceId: 'instance-1',
          storageKey: 'media/asset-pending',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 256_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Asset mit laufendem Enrichment',
            altText: 'Noch nicht abgeschlossene Usage-Antwort',
          },
          technical: {},
        },
      ],
      usageByAssetId: {
        'asset-unavailable': null,
        'asset-pending': null,
      },
      usageStatusByAssetId: {
        'asset-unavailable': 'unavailable',
        'asset-pending': 'loading',
      },
      isUsageLoading: true,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 2,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(screen.getByText('Nutzung nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Nutzung wird geladen')).toBeTruthy();
  });

  it('passes pagination state into the media hook and exposes page controls', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-page-1',
          instanceId: 'instance-1',
          storageKey: 'media/asset-page-1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 256_000,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {
            title: 'Seitenwechsel',
            altText: 'Pagination-Testasset',
          },
          technical: {},
        },
      ],
      usageByAssetId: {
        'asset-page-1': 1,
      },
      usageStatusByAssetId: {
        'asset-page-1': 'ready',
      },
      isUsageLoading: false,
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 36,
      total: 60,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ page: 1, pageSize: 36 });

    fireEvent.click(screen.getByRole('button', { name: 'Nächste Seite' }));
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ page: 2, pageSize: 36 });

    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '72' } });
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ page: 1, pageSize: 72 });
  });
});

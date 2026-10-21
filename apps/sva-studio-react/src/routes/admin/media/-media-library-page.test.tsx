import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaLibraryPage } from './-media-library-page';

const inventoryApi = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn() }));
vi.mock('../../../lib/iam-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/iam-api')>()),
  startMediaInventoryScan: inventoryApi.start,
  getMediaInventoryScan: inventoryApi.get,
}));

const accessState = vi.hoisted(() => ({ deniedActions: new Set<string>() }));

vi.mock('../../../providers/effective-access-provider', () => ({
  useAccessDecision: (requirement: { actions: { values: readonly string[] } }) =>
    requirement.actions.values.some((action) => accessState.deniedActions.has(action))
      ? { status: 'denied', reason: 'permission_missing' }
      : { status: 'allowed', reason: 'allowed_by_permission' },
}));

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
  it('preserves the running scan, report and continuation cursor across library reloads and errors', async () => {
    inventoryApi.start.mockResolvedValue({ data: { id: 'scan-1', status: 'queued' } });
    let complete: (value: unknown) => void = () => undefined;
    inventoryApi.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const { rerender } = render(<MediaLibraryPage />);
    const loaded = useMediaLibraryMock.mock.results.at(-1)?.value;
    fireEvent.change(screen.getByLabelText('Dateien pro Lauf'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestandsscan starten' }));
    await waitFor(() =>
      expect(inventoryApi.get).toHaveBeenCalledWith('scan-1', expect.any(AbortSignal))
    );
    const signal = inventoryApi.get.mock.calls[0]?.[1] as AbortSignal;
    useMediaLibraryMock.mockReturnValue({ ...loaded, isLoading: true });
    rerender(<MediaLibraryPage />);
    expect(signal.aborted).toBe(false);
    complete({
      data: {
        id: 'scan-1',
        status: 'succeeded',
        report: {
          completedAt: '2026-10-21T08:00:00Z',
          nextCursor: 'next-page',
          entries: [
            {
              storageKey: 'tenant-a/found.txt',
              verdict: 'infected',
              checkedAt: '2026-10-21T08:00:00Z',
              byteSize: 68,
            },
          ],
        },
      },
    });
    await screen.findByText('Fund');
    useMediaLibraryMock.mockReturnValue({ ...loaded, error: { code: 'database_unavailable' } });
    rerender(<MediaLibraryPage />);
    expect(screen.getByText('Fund')).toBeTruthy();
    useMediaLibraryMock.mockReturnValue(loaded);
    rerender(<MediaLibraryPage />);
    expect(screen.getByText('Fund')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nächsten Abschnitt prüfen' }));
    await waitFor(() =>
      expect(inventoryApi.start).toHaveBeenLastCalledWith({ limit: 3, cursor: 'next-page' })
    );
    expect(inventoryApi.start).toHaveBeenCalledTimes(2);
  });

  it('hides inventory scan when media.update is unavailable', () => {
    accessState.deniedActions.add('media.update');
    render(<MediaLibraryPage />);
    expect(screen.queryByRole('button', { name: 'Bestandsscan starten' })).toBeNull();
  });
  it('submits search and tag together and resets pagination when clearing filters', () => {
    render(<MediaLibraryPage />);
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Park' } });
    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Rathaus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtern' }));
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ cursor: undefined, limit: 36, search: 'Rathaus', tag: 'Park' });
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ cursor: undefined, limit: 36 });
  });

  const uploadFileMock = vi.fn();

  beforeEach(() => {
    accessState.deniedActions.clear();
    inventoryApi.start.mockReset();
    inventoryApi.get.mockReset().mockResolvedValue({ data: { id: 'scan-1', status: 'succeeded' } });
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
          storageKey:
            'instance-1/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg',
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
        'instance-1/cms_uploads/mew1020_greatEastern2-521baae3a2ee4ee542334ded26368ddb.jpg':
          'unavailable',
      },
      isUsageLoading: false,
      isLoading: false,
      error: null,
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
    expect(screen.getByTestId('media-intake-shelf').querySelectorAll('svg')).toHaveLength(2);
    expect(screen.queryByText('Blockiert')).toBeNull();
    expect(screen.queryByText('Neu')).toBeNull();
    expect(screen.queryByText('Ungenutzt')).toBeNull();
  });

  it('opens the hidden file input from the intake CTA and forwards the selected file into the upload hook', () => {
    const inputClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
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

  it('keeps the drag state while moving inside the shelf and clears it only after leaving the region', () => {
    render(<MediaLibraryPage />);

    const shelf = screen.getByTestId('media-intake-shelf');
    const containsSpy = vi.spyOn(shelf, 'contains');

    fireEvent.dragEnter(shelf, {
      dataTransfer: {
        files: [],
        dropEffect: 'none',
      },
    });
    expect(shelf.className).toContain('bg-muted/30');

    containsSpy.mockReturnValueOnce(true);
    fireEvent.dragLeave(shelf, {
      relatedTarget: document.createElement('div'),
    });
    expect(shelf.className).toContain('bg-muted/30');

    containsSpy.mockReturnValueOnce(false);
    fireEvent.dragLeave(shelf, {
      relatedTarget: null,
    });
    expect(shelf.className).not.toContain('bg-muted/30');
  });

  it('ignores drag-and-drop uploads while the intake shelf is busy', () => {
    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'uploading',
      error: null,
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });

    render(<MediaLibraryPage />);

    const file = new File(['binary'], 'hero.jpg', { type: 'image/jpeg' });
    const shelf = screen.getByTestId('media-intake-shelf');

    fireEvent.dragEnter(shelf, {
      dataTransfer: {
        files: [file],
      },
    });
    expect(shelf.className).not.toContain('border-primary/50');

    fireEvent.drop(shelf, {
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
    expect(screen.getByText('Bild wird verarbeitet …')).toBeTruthy();

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
      screen.getByText(
        'Die Mediendaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.'
      )
    ).toBeTruthy();
  });

  it.each([
    ['forbidden', 'Unzureichende Berechtigungen für diese Medienaktion.'],
    ['invalid_media_content', 'Das hochgeladene Medium konnte nicht validiert werden.'],
    ['upload_size_exceeded', 'Das hochgeladene Medium überschreitet die erlaubte Größe.'],
    ['unknown_code', 'Der Upload konnte nicht abgeschlossen werden.'],
  ])('renders the mapped intake error message for %s', (code, expectedMessage) => {
    useSingleFileMediaUploadMock.mockReturnValue({
      phase: 'error',
      error: { code },
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadFile: uploadFileMock,
      reset: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(screen.getByText(expectedMessage)).toBeTruthy();
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
    expect(
      screen.getByRole('img', { name: 'Stadtfest 2024 - Hauptbühne' }).getAttribute('src')
    ).toBe('https://cdn.example.test/media/asset-ready.jpg');
  });

  it('keeps image labels visible when no preview URL is available', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByText('Blockierte Medienprobe')).toBeTruthy();
    expect(screen.getByText('Verarbeitung fehlgeschlagen')).toBeTruthy();
    expect(screen.getByText('Titel fehlt noch')).toBeTruthy();
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
    expect(screen.queryByText(/^Ordner$/)).toBeNull();
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
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
      limit: 36,
      nextCursor: null,
      hasNextPage: false,
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
      limit: 36,
      nextCursor: 'cursor-next',
      hasNextPage: true,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ cursor: undefined, limit: 36 });

    fireEvent.click(screen.getByRole('button', { name: 'Nächste Seite' }));
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ cursor: 'cursor-next', limit: 36 });

    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '72' } });
    expect(useMediaLibraryMock).toHaveBeenLastCalledWith({ cursor: undefined, limit: 72 });
  });

  it('hides all create entry points without media.create', () => {
    accessState.deniedActions.add('media.create');

    render(<MediaLibraryPage />);

    expect(screen.queryByRole('link', { name: 'Medium vorbereiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dateien auswählen' })).toBeNull();
    expect(screen.queryByTestId('media-intake-shelf')).toBeNull();
  });
});

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaLibraryPage } from './-media-library-page';

const useMediaLibraryMock = vi.fn();

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
}));

vi.mock('../../../hooks/use-media', () => ({
  useMediaLibrary: (...args: unknown[]) => useMediaLibraryMock(...args),
}));

describe('MediaLibraryPage', () => {
  beforeEach(() => {
    useMediaLibraryMock.mockReset();
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-ready',
          instanceId: 'instance-1',
          storageKey: 'media/asset-ready',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 2_048_000,
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
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the intake shelf above the asset grid', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByRole('heading', { name: 'Medienbibliothek' })).toBeTruthy();
    expect(screen.getByText('Quick Intake')).toBeTruthy();
    expect(screen.queryByText('Blockiert')).toBeNull();
    expect(screen.queryByText('Neu')).toBeNull();
    expect(screen.queryByText('Ungenutzt')).toBeNull();
  });

  it('renders asset cards with usage and status hints instead of the raw table', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByText('Stadtfest 2024 - Hauptbühne')).toBeTruthy();
    expect(screen.getByText('3 Verwendungen')).toBeTruthy();
    expect(screen.getByText('1 Verwendung')).toBeTruthy();
    expect(screen.getAllByText('bereit').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Stadtfest 2024 - Hauptbühne/i }).getAttribute('href')).toBe(
      '/admin/media/asset-ready'
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
    expect(screen.getByText('Ordner: uploads/2026/06')).toBeTruthy();
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

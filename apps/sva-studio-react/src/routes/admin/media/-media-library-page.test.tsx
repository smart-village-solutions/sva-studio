import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaLibraryPage } from './-media-library-page';

const useMediaLibraryMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { readonly to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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
      ],
      usageByAssetId: {
        'asset-ready': 3,
        'asset-blocked': 1,
        'asset-new': 2,
        'asset-unused': 0,
        'asset-pdf': 4,
      },
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 25,
      total: 5,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders intake and priority shelves above the asset grid', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByRole('heading', { name: 'Medienbibliothek' })).toBeTruthy();
    expect(screen.getByText('Quick Intake')).toBeTruthy();
    expect(screen.getByText('Blockiert')).toBeTruthy();
    expect(screen.getByText('Neu')).toBeTruthy();
    expect(screen.getByText('Ungenutzt')).toBeTruthy();
  });

  it('renders asset cards with usage and status hints instead of the raw table', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByText('Stadtfest 2024 - Hauptbühne')).toBeTruthy();
    expect(screen.getByText('3 Verwendungen')).toBeTruthy();
    expect(screen.getByText('1 Verwendung')).toBeTruthy();
    expect(screen.getAllByText('bereit').length).toBeGreaterThan(0);
  });

  it('renders non-image assets with a dedicated fallback card pattern', () => {
    render(<MediaLibraryPage />);

    expect(screen.getByText('Veranstaltungsflyer 2024')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('renders the empty state when no library assets are available', () => {
    useMediaLibraryMock.mockReturnValue({
      assets: [],
      usageByAssetId: {},
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 25,
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
      isLoading: false,
      error: { code: 'database_unavailable' },
      page: 1,
      pageSize: 25,
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
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 25,
      total: 1,
      refetch: vi.fn(),
    });

    render(<MediaLibraryPage />);

    expect(screen.getByText('Nutzung nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('bereit')).toBeTruthy();
  });
});

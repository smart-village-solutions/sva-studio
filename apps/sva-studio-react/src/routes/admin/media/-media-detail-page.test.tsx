import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaDetailPage } from './-media-detail-page';

const useMediaDetailMock = vi.fn();
const navigateMock = vi.fn();
const qrCodeToDataUrlMock = vi.fn();
const qrCodeToStringMock = vi.fn();
const clipboardWriteTextMock = vi.fn();

vi.mock('qrcode', () => ({
  toDataURL: (...args: unknown[]) => qrCodeToDataUrlMock(...args),
  toString: (...args: unknown[]) => qrCodeToStringMock(...args),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { readonly to: string; readonly params?: Record<string, string> }) => {
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
  useMediaDetail: (...args: unknown[]) => useMediaDetailMock(...args),
}));

describe('MediaDetailPage', () => {
  beforeEach(() => {
    useMediaDetailMock.mockReset();
    navigateMock.mockReset();
    qrCodeToDataUrlMock.mockReset();
    qrCodeToStringMock.mockReset();
    clipboardWriteTextMock.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });
    clipboardWriteTextMock.mockResolvedValue(undefined);
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 4096,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: 'Detail Asset',
          altText: 'Ausschnitt der Bühnenbeleuchtung',
          description: 'Hero-Motiv für den zentralen Kampagnenbereich',
        },
        technical: {},
      },
      usage: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [
          {
            id: 'ref-1',
            assetId: 'asset-2',
            targetType: 'news',
            targetId: 'news-hero',
            role: 'teaser_image',
          },
        ],
      },
      delivery: {
        assetId: 'asset-2',
        visibility: 'public',
        deliveryUrl: 'https://delivery.example.test',
        expiresAt: '2026-06-04T12:00:00.000Z',
      },
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the asset workspace header with preview-independent status and action context', () => {
    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.getByRole('heading', { name: 'Detail Asset' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ausschnitt der Bühnenbeleuchtung' }).getAttribute('src')).toBe(
      'https://delivery.example.test'
    );
    expect(screen.getByText('1 Verwendung')).toBeTruthy();
    expect(screen.getByText('Öffentlich')).toBeTruthy();
    expect(screen.getByText('Auslieferungs-URL')).toBeTruthy();
  });

  it('shows the public url tools with copy and qr actions for public assets', async () => {
    qrCodeToStringMock.mockResolvedValue('<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>');
    qrCodeToDataUrlMock.mockResolvedValue('data:image/png;base64,qrpng');

    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.getByText('Öffentliche URL')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Auslieferungslink erzeugen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'https://delivery.example.test' }).getAttribute('rel')).toBe(
      'noopener noreferrer'
    );
    expect(screen.getByRole('link', { name: 'Öffnen' }).getAttribute('rel')).toBe('noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche URL kopieren' }));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('https://delivery.example.test');
    });

    fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'QR-Code zur öffentlichen URL' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'QR-Code als PNG laden' }).getAttribute('href')).toBe('data:image/png;base64,qrpng');
      expect(screen.getByRole('link', { name: 'QR-Code als PNG laden' }).getAttribute('download')).toBe('detail-asset-qr.png');
      expect(screen.getByRole('link', { name: 'QR-Code als SVG laden' }).getAttribute('href')).toContain(
        'data:image/svg+xml'
      );
      expect(screen.getByRole('link', { name: 'QR-Code als SVG laden' }).getAttribute('download')).toBe('detail-asset-qr.svg');
    });
  });

  it('uses the document clipboard fallback when the browser clipboard API is unavailable', async () => {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommandMock = vi.mocked(document.execCommand);

    render(<MediaDetailPage assetId="asset-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche URL kopieren' }));

    await Promise.resolve();
    await Promise.resolve();

    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('shows a copy error hint when the clipboard write fails', async () => {
    clipboardWriteTextMock.mockRejectedValue(new Error('clipboard blocked'));

    render(<MediaDetailPage assetId="asset-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche URL kopieren' }));

    await waitFor(() => {
      expect(screen.getByText('Der Link konnte derzeit nicht kopiert werden.')).toBeTruthy();
    });
  });

  it('shows the qr dialog loading state and closes it again while generation is still pending', async () => {
    const svgRequest = new Promise<string>(() => undefined);
    const pngRequest = new Promise<string>(() => undefined);
    qrCodeToStringMock.mockReturnValue(svgRequest);
    qrCodeToDataUrlMock.mockReturnValue(pngRequest);

    render(<MediaDetailPage assetId="asset-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));

    await waitFor(() => {
      expect(screen.getByText('Medien werden geladen ...')).toBeTruthy();
    });

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toBeTruthy();

    fireEvent.click(overlay as Element);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'QR-Code zur öffentlichen URL' })).toBeNull();
    });
  });

  it('shows the delivery action instead of public url tools for protected assets without a preview delivery', () => {
    const resolveDelivery = vi.fn();
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'application/pdf',
        byteSize: 4096,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: 'Geschuetztes PDF',
        },
        technical: {},
      },
      usage: {
        assetId: 'asset-2',
        totalReferences: 2,
        references: [],
      },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery,
      deleteMedia: vi.fn(),
    });

    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.queryByText('Öffentliche URL')).toBeNull();
    expect(screen.getAllByText('application/pdf').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Auslieferungslink erzeugen' }));

    expect(resolveDelivery).toHaveBeenCalledTimes(1);
  });

  it('shows a qr generation error when the qr code renderer fails', async () => {
    qrCodeToStringMock.mockRejectedValue(new Error('qr failed'));
    qrCodeToDataUrlMock.mockRejectedValue(new Error('qr failed'));

    render(<MediaDetailPage assetId="asset-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));

    await waitFor(() => {
      expect(screen.getByText('Der QR-Code konnte derzeit nicht erzeugt werden.')).toBeTruthy();
    });
  });

  it('renders usage information inside the detail workspace instead of requiring a separate usage screen', () => {
    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('Teaserbild')).toBeTruthy();
    expect(screen.getByText('news-hero')).toBeTruthy();
  });

  it('renders conflict mutation errors with the media-specific message', () => {
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 4096,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
      },
      usage: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [],
      },
      isLoading: false,
      error: null,
      mutationError: { status: 409, code: 'conflict', message: 'Conflict' },
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(),
    });

    render(<MediaDetailPage assetId="asset-2" />);

    expect(
      screen.getByText('Die Medienaktion konnte wegen eines Konflikts nicht abgeschlossen werden.')
    ).toBeTruthy();
  });

  it('renders a detail-specific fallback message when the page data cannot be loaded', () => {
    useMediaDetailMock.mockReturnValue({
      asset: null,
      usage: null,
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(),
    });

    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.getByText('Die Mediendetailansicht konnte nicht geladen werden.')).toBeTruthy();
    expect(screen.queryByText('Die Medienbibliothek konnte nicht geladen werden.')).toBeNull();
  });

  it('navigates back to the media library after a successful deletion', async () => {
    const deleteMedia = vi.fn(async () => true);
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 4096,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
      },
      usage: {
        assetId: 'asset-2',
        totalReferences: 0,
        references: [],
      },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia,
    });

    render(<MediaDetailPage assetId="asset-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium löschen' }));

    await waitFor(() => {
      expect(deleteMedia).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/media' });
    });
  });
});

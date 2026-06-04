import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaDetailPage } from './-media-detail-page';

const useMediaDetailMock = vi.fn();
const navigateMock = vi.fn();

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
        visibility: 'protected',
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
  });

  it('renders the asset workspace header with preview-independent status and action context', () => {
    render(<MediaDetailPage assetId="asset-2" />);

    expect(screen.getByRole('heading', { name: 'Detail Asset' })).toBeTruthy();
    expect(screen.getByText('1 Verwendung')).toBeTruthy();
    expect(screen.getByText('Geschützt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Auslieferungslink erzeugen' })).toBeTruthy();
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

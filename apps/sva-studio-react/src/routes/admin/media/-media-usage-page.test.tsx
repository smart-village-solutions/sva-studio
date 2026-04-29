import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUsagePage } from './-media-usage-page';

const useParamsMock = vi.fn();
const useMediaDetailMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => {
    const href = typeof params?.mediaId === 'string' ? to.replace('$mediaId', params.mediaId) : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useParams: () => useParamsMock(),
}));

vi.mock('../../../hooks/use-media', () => ({
  useMediaDetail: (...args: unknown[]) => useMediaDetailMock(...args),
}));

describe('MediaUsagePage', () => {
  beforeEach(() => {
    useParamsMock.mockReset();
    useMediaDetailMock.mockReset();

    useParamsMock.mockReturnValue({ mediaId: 'asset-1' });
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-1',
        instanceId: 'instance-1',
        storageKey: 'media/asset-1',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 4096,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Hero' },
        technical: {},
      },
      usage: {
        assetId: 'asset-1',
        totalReferences: 2,
        references: [
          { id: 'ref-1', assetId: 'asset-1', targetType: 'news', targetId: 'news-1', role: 'teaser_image', sortOrder: 0 },
          { id: 'ref-2', assetId: 'asset-1', targetType: 'events', targetId: 'event-2', role: 'header_image' },
        ],
      },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the usage impact view and back links', () => {
    render(<MediaUsagePage />);

    expect(screen.getByRole('heading', { name: 'Usage-Impact' })).toBeTruthy();
    expect(screen.getByText('Aktive Referenzen: 2')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getByText('Teaserbild')).toBeTruthy();
    expect(screen.getByText('Headerbild')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zur Mediendetailansicht' }).getAttribute('href')).toBe('/admin/media/asset-1');
  });

  it('renders the loading state before usage data is available', () => {
    useMediaDetailMock.mockReturnValue({
      asset: null,
      usage: null,
      delivery: null,
      isLoading: true,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
    });

    render(<MediaUsagePage />);

    expect(screen.getByText('Medien werden geladen ...')).toBeTruthy();
  });

  it('renders the error state for missing assets', () => {
    useMediaDetailMock.mockReturnValue({
      asset: null,
      usage: null,
      delivery: null,
      isLoading: false,
      error: { code: 'not_found' },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
    });

    render(<MediaUsagePage />);

    expect(screen.getByText('Das angeforderte Medium wurde nicht gefunden.')).toBeTruthy();
  });

  it('renders the empty usage state and falls back to the asset id when no title exists', () => {
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 2048,
        visibility: 'public',
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
    });

    render(<MediaUsagePage />);

    expect(screen.getByText('asset-2')).toBeTruthy();
    expect(screen.getByText('Dieses Medium ist aktuell nicht referenziert.')).toBeTruthy();
  });
});

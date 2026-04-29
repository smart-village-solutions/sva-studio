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
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaPage } from './-media-page';

const useLocationMock = vi.fn();
const useParamsMock = vi.fn();
const useSearchMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
  useParams: () => useParamsMock(),
  useSearch: () => useSearchMock(),
}));

vi.mock('./-media-library-page.js', () => ({
  MediaLibraryPage: () => <section data-testid="media-library-page" />,
}));

vi.mock('./-media-create-page.js', () => ({
  MediaCreatePage: () => <section data-testid="media-create-page" />,
}));

vi.mock('./-media-detail-page.js', () => ({
  MediaDetailPage: ({ assetId }: { readonly assetId: string }) => (
    <section data-testid="media-detail-page" data-asset-id={assetId} />
  ),
}));

vi.mock('./-media-unregistered-detail-page.js', () => ({
  MediaUnregisteredDetailPage: ({ asset }: { readonly asset: { storageKey: string } | null }) => (
    <section data-testid="media-unregistered-detail-page" data-storage-key={asset?.storageKey ?? ''} />
  ),
}));

describe('MediaPage', () => {
  beforeEach(() => {
    useLocationMock.mockReset();
    useParamsMock.mockReset();
    useSearchMock.mockReset();

    useLocationMock.mockReturnValue({ pathname: '/admin/media' });
    useParamsMock.mockReturnValue({});
    useSearchMock.mockReturnValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the library page on /admin/media', () => {
    render(<MediaPage />);

    expect(screen.getByTestId('media-library-page')).toBeTruthy();
    expect(screen.queryByTestId('media-create-page')).toBeNull();
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
    expect(screen.queryByTestId('media-unregistered-detail-page')).toBeNull();
  });

  it('renders the create page on /admin/media/new', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });

    render(<MediaPage />);

    expect(screen.getByTestId('media-create-page')).toBeTruthy();
    expect(screen.queryByTestId('media-library-page')).toBeNull();
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
    expect(screen.queryByTestId('media-unregistered-detail-page')).toBeNull();
  });

  it('prefers the create page when the optional route param resolves to new', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });
    useParamsMock.mockReturnValue({ mediaId: 'new' });

    render(<MediaPage />);

    expect(screen.getByTestId('media-create-page')).toBeTruthy();
    expect(screen.queryByTestId('media-library-page')).toBeNull();
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
    expect(screen.queryByTestId('media-unregistered-detail-page')).toBeNull();
  });

  it('renders the detail page on /admin/media/asset-2', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });

    render(<MediaPage />);

    expect(screen.getByTestId('media-detail-page').getAttribute('data-asset-id')).toBe('asset-2');
    expect(screen.queryByTestId('media-library-page')).toBeNull();
    expect(screen.queryByTestId('media-create-page')).toBeNull();
    expect(screen.queryByTestId('media-unregistered-detail-page')).toBeNull();
  });

  it('renders the unregistered detail page for bucket route ids', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/bucket:Y21zX3VwbG9hZHMvcGhvdG8uanBn' });
    useParamsMock.mockReturnValue({ mediaId: 'bucket:Y21zX3VwbG9hZHMvcGhvdG8uanBn' });
    useSearchMock.mockReturnValue({
      fileName: 'photo.jpg',
      folderPath: 'cms_uploads',
      relativePath: 'cms_uploads/photo.jpg',
      byteSize: '42',
      previewUrl: 'https://files.example.test/cms_uploads/photo.jpg',
    });

    render(<MediaPage />);

    expect(screen.getByTestId('media-unregistered-detail-page').getAttribute('data-storage-key')).toBe(
      'cms_uploads/photo.jpg'
    );
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
  });
});

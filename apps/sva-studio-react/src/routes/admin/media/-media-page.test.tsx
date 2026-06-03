import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaPage } from './-media-page';

const useLocationMock = vi.fn();
const useParamsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
  useParams: () => useParamsMock(),
}));

describe('MediaPage', () => {
  beforeEach(() => {
    useLocationMock.mockReset();
    useParamsMock.mockReset();

    useLocationMock.mockReturnValue({ pathname: '/admin/media' });
    useParamsMock.mockReturnValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the library page on /admin/media', () => {
    render(<MediaPage />);

    expect(screen.getByTestId('media-library-page')).toBeTruthy();
    expect(screen.queryByTestId('media-create-page')).toBeNull();
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
  });

  it('renders the create page on /admin/media/new', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });

    render(<MediaPage />);

    expect(screen.getByTestId('media-create-page')).toBeTruthy();
    expect(screen.queryByTestId('media-library-page')).toBeNull();
    expect(screen.queryByTestId('media-detail-page')).toBeNull();
  });

  it('renders the detail page on /admin/media/asset-2', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });

    render(<MediaPage />);

    expect(screen.getByTestId('media-detail-page').getAttribute('data-asset-id')).toBe('asset-2');
    expect(screen.queryByTestId('media-library-page')).toBeNull();
    expect(screen.queryByTestId('media-create-page')).toBeNull();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUsagePage } from './-media-usage-page';

const useParamsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => useParamsMock(),
}));

vi.mock('./-media-detail-page.js', () => ({
  MediaDetailPage: ({ assetId }: Readonly<{ assetId: string }>) => (
    <section data-testid="media-detail-page" data-asset-id={assetId} />
  ),
}));

describe('MediaUsagePage', () => {
  beforeEach(() => {
    useParamsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('routes usage requests into the detail workspace when a media id is present', () => {
    useParamsMock.mockReturnValue({ mediaId: 'asset-1' });

    render(<MediaUsagePage />);

    expect(screen.getByTestId('media-detail-page').getAttribute('data-asset-id')).toBe('asset-1');
  });

  it('renders nothing when no media id is available', () => {
    useParamsMock.mockReturnValue({});

    render(<MediaUsagePage />);

    expect(screen.queryByTestId('media-detail-page')).toBeNull();
  });
});

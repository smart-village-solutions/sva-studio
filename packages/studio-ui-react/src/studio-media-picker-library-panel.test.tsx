import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioMediaPickerLibraryPanel } from './studio-media-picker-library-panel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('media picker tag search', () => {
  it('queries the server for a tag rather than filtering only the initial page', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: 'beyond-page',
            metadata: { title: 'Park' },
            mimeType: 'image/jpeg',
            uploadStatus: 'processed',
            processingStatus: 'ready',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <StudioMediaPickerLibraryPanel
        assets={[]}
        searchValue=""
        onSearchValueChange={vi.fn()}
        onSelectAsset={vi.fn()}
        labels={{
          searchLabel: 'Search',
          tagLabel: 'Tag',
          loading: 'Loading',
          loadError: 'Failed',
          empty: 'Empty',
          select: 'Select',
        }}
      />
    );
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'Grün' } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/iam/media?tag=Gr%C3%BCn&visibility=public',
        expect.objectContaining({ credentials: 'include', signal: expect.any(AbortSignal) })
      )
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy());
  });
});

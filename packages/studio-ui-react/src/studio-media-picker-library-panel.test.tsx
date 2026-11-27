import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioMediaPickerLibraryPanel } from './studio-media-picker-library-panel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('media picker tag search', () => {
  it('distinguishes initial loading and failure from an empty library and offers retry', () => {
    const retry = vi.fn();
    const props = {
      assets: [],
      searchValue: '',
      onSearchValueChange: vi.fn(),
      onSelectAsset: vi.fn(),
      labels: {
        searchLabel: 'Search',
        loading: 'Loading',
        loadError: 'Failed',
        empty: 'Empty',
        select: 'Select',
      },
    };
    const { rerender } = render(
      <StudioMediaPickerLibraryPanel
        {...props}
        libraryStatus={{ loading: true, error: false, onRetry: retry }}
      />
    );
    expect(screen.getByRole('status').textContent).toBe('Loading');
    expect(screen.queryByText('Empty')).toBeNull();
    rerender(
      <StudioMediaPickerLibraryPanel
        {...props}
        libraryStatus={{ loading: false, error: true, onRetry: retry }}
      />
    );
    expect(screen.getByRole('alert').textContent).toBe('Failed');
    expect(screen.queryByText('Empty')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('filters local assets by title or filename when server search is unavailable', () => {
    const props = {
      assets: [{ id: 'one', title: 'Museum', fileName: 'entry.jpg' }],
      searchValue: 'MuSe',
      onSearchValueChange: vi.fn(),
      onSelectAsset: vi.fn(),
      labels: { searchLabel: 'Search', empty: 'Empty', select: 'Select' },
    };
    const { rerender } = render(<StudioMediaPickerLibraryPanel {...props} />);
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
    rerender(<StudioMediaPickerLibraryPanel {...props} searchValue="ENTRY" />);
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
    rerender(<StudioMediaPickerLibraryPanel {...props} searchValue="missing" />);
    expect(screen.getByText('Empty')).toBeTruthy();
  });

  it('exposes MP3 only to pickers that opt in', () => {
    const props = {
      assets: [
        { id: 'image', title: 'Museum photo', fileName: 'photo.jpg', mimeType: 'image/jpeg' },
        { id: 'audio', title: 'Guided walk', fileName: 'walk.mp3', mimeType: 'audio/mpeg' },
      ],
      searchValue: '',
      onSearchValueChange: vi.fn(),
      onSelectAsset: vi.fn(),
      labels: { searchLabel: 'Search', empty: 'Empty', select: 'Select' },
    };
    const { rerender } = render(<StudioMediaPickerLibraryPanel {...props} />);
    expect(screen.queryByText('walk.mp3')).toBeNull();
    rerender(<StudioMediaPickerLibraryPanel {...props} allowAudio />);
    expect(screen.getByText('walk.mp3')).toBeTruthy();
    expect(screen.getByText('photo.jpg')).toBeTruthy();
    rerender(<StudioMediaPickerLibraryPanel {...props} allowAudio="only" />);
    expect(screen.getByText('walk.mp3')).toBeTruthy();
    expect(screen.queryByText('photo.jpg')).toBeNull();
  });

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

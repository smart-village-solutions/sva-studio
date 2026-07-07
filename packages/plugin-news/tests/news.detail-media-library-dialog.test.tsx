import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NewsDetailMediaLibraryDialog } from '../src/news.detail-media-library-dialog.js';

const pt = (key: string) => key;

const asset = {
  id: 'asset-1',
  fileName: 'teaser.jpg',
  mimeType: 'image/jpeg',
  previewUrl: 'https://cdn.example.com/teaser.jpg',
  visibility: 'public',
  metadata: {
    title: 'Titelbild',
  },
};

describe('NewsDetailMediaLibraryDialog', () => {
  it('filters already selected or non-matching assets and selects the remaining asset', () => {
    const onSelectAsset = vi.fn();
    const setSearchValue = vi.fn();

    render(
      <NewsDetailMediaLibraryDialog
        mediaAssets={[
          asset,
          { ...asset, id: 'asset-2', fileName: 'private.jpg', previewUrl: 'https://cdn.example.com/private.jpg', visibility: 'private' },
          { ...asset, id: 'asset-3', fileName: 'poster.jpg', previewUrl: 'https://cdn.example.com/poster.jpg', metadata: { title: 'Poster' } },
        ]}
        mediaContents={[{ sourceUrl: { url: 'https://cdn.example.com/poster.jpg', description: '' } } as never]}
        onClose={() => undefined}
        onSelectAsset={onSelectAsset}
        open
        pt={pt}
        searchValue="titel"
        setSearchValue={setSearchValue}
      />
    );

    expect(screen.getByText('Titelbild')).toBeTruthy();
    expect(screen.queryByText('Poster')).toBeNull();
    expect(screen.queryByText('private.jpg')).toBeNull();

    fireEvent.change(screen.getByLabelText('fields.imageSearch'), { target: { value: 'neu' } });
    expect(setSearchValue).toHaveBeenCalledWith('neu');

    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    expect(onSelectAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset-1' }));
  });

  it('shows the empty state when no selectable asset matches', () => {
    render(
      <NewsDetailMediaLibraryDialog
        mediaAssets={[{ ...asset, visibility: 'private' }]}
        mediaContents={[]}
        onClose={() => undefined}
        onSelectAsset={() => undefined}
        open
        pt={pt}
        searchValue="missing"
        setSearchValue={() => undefined}
      />
    );

    expect(screen.getByText('messages.imagePickerEmpty')).toBeTruthy();
  });
});

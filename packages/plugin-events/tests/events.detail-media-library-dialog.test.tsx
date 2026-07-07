import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EventsDetailMediaLibraryDialog } from '../src/events.detail-media-library-dialog.js';

const pt = (key: string) => key;

const asset = {
  id: 'asset-1',
  fileName: 'flyer.png',
  mimeType: 'image/png',
  previewUrl: 'https://cdn.example.com/flyer.png',
  visibility: 'public',
  metadata: {
    title: 'Sommerfest',
  },
};

describe('EventsDetailMediaLibraryDialog', () => {
  it('filters selected and non-matching assets and selects remaining entries', () => {
    const onSelectAsset = vi.fn();
    const setSearchValue = vi.fn();

    render(
      <EventsDetailMediaLibraryDialog
        mediaAssets={[
          asset,
          { ...asset, id: 'asset-2', fileName: 'private.png', previewUrl: 'https://cdn.example.com/private.png', visibility: 'private' },
          { ...asset, id: 'asset-3', fileName: 'poster.png', previewUrl: 'https://cdn.example.com/poster.png', metadata: { title: 'Poster' } },
        ]}
        mediaContents={[{ sourceUrl: { url: 'https://cdn.example.com/poster.png', description: '' } }]}
        onClose={() => undefined}
        onSelectAsset={onSelectAsset}
        open
        pt={pt}
        searchValue="sommer"
        setSearchValue={setSearchValue}
      />
    );

    expect(screen.getByText('Sommerfest')).toBeTruthy();
    expect(screen.queryByText('Poster')).toBeNull();
    expect(screen.queryByText('private.png')).toBeNull();

    fireEvent.change(screen.getByLabelText('fields.imageSearch'), { target: { value: 'neu' } });
    expect(setSearchValue).toHaveBeenCalledWith('neu');

    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    expect(onSelectAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset-1' }));
  });

  it('renders the empty state when no selectable asset remains', () => {
    render(
      <EventsDetailMediaLibraryDialog
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

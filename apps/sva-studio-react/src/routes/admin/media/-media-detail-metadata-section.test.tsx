import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaDetailMetadataSection } from './-media-detail-metadata-section';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';

vi.mock('../../../i18n', () => ({ t: (key: string) => key }));
const asset = { id: 'asset-1', metadata: { tags: ['Park'] } } as IamRegisteredMediaAsset;

describe('central media metadata editor', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it('normalizes tags before saving and permits clearing the list', async () => {
    const save = vi.fn(async () => true);
    render(<MediaDetailMetadataSection asset={asset} canEdit onSave={save} />);
    const input = screen.getByLabelText('media.fields.tags');
    fireEvent.change(input, { target: { value: ' Grün   Raum \nGRÜN RAUM' } });
    fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Grün Raum'] }))
    );
    await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ tags: [] }))
    );
  });
  it('rejects oversized tags without sending a mutation', () => {
    const save = vi.fn();
    render(<MediaDetailMetadataSection asset={asset} canEdit onSave={save} />);
    fireEvent.change(screen.getByLabelText('media.fields.tags'), {
      target: { value: 'x'.repeat(65) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    expect(screen.getByRole('alert').textContent).toContain('media.errors.invalidTags');
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the full metadata patch including clearing fields without changing the source', async () => {
    const save = vi.fn(async () => true);
    render(<MediaDetailMetadataSection asset={asset} canEdit onSave={save} />);
    fireEvent.change(screen.getByLabelText('media.fields.title'), {
      target: { value: ' Rathaus ' },
    });
    fireEvent.change(screen.getByLabelText('media.fields.copyright'), {
      target: { value: ' Stadt ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        title: 'Rathaus',
        copyright: 'Stadt',
        altText: null,
        description: null,
        license: null,
        tags: ['Park'],
      })
    );
    expect(asset.metadata).toEqual({ tags: ['Park'] });
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'account.actions.saved'
    );
  });

  it('retains changes on a rejected save and discards them only on explicit action', async () => {
    const save = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<MediaDetailMetadataSection asset={asset} canEdit onSave={save} />);
    const title = screen.getByLabelText('media.fields.title') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'media.errors.metadataSave'
    );
    expect(title.value).toBe('Unsaved');
    fireEvent.click(screen.getByText('media.actions.discardMetadata'));
    expect(title.value).toBe('');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('shows saved feedback for exactly two seconds and clears it on later edits', async () => {
    vi.useFakeTimers();
    render(<MediaDetailMetadataSection asset={asset} canEdit onSave={async () => true} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    });
    expect(screen.getByRole('button', { name: 'account.actions.saved' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByRole('button', { name: 'account.actions.saved' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('button', { name: 'media.actions.save' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'media.actions.save' }));
    });
    fireEvent.change(screen.getByLabelText('media.fields.title'), {
      target: { value: 'Neue Eingabe' },
    });
    expect(screen.queryByRole('button', { name: 'account.actions.saved' })).toBeNull();
  });

  it('keeps all metadata read-only without update permission', () => {
    render(<MediaDetailMetadataSection asset={asset} />);
    expect((screen.getByLabelText('media.fields.title') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('media.fields.tags') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.queryByText('media.actions.save')).toBeNull();
  });
});

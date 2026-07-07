import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useEventsDetailMediaState } from '../src/events.detail-media-state.js';

const createAsset = (overrides = {}) => ({
  id: 'asset-1',
  fileName: 'flyer.png',
  mimeType: 'image/png',
  previewUrl: 'https://cdn.example.com/flyer.png',
  visibility: 'public',
  metadata: { title: 'Sommerfest' },
  ...overrides,
});

describe('useEventsDetailMediaState', () => {
  it('manages dialog state and appends manual or selected media entries', () => {
    const append = vi.fn();
    const remove = vi.fn();

    const { result } = renderHook(() =>
      useEventsDetailMediaState({
        append,
        onUploadFile: vi.fn(),
        remove,
      })
    );

    expect(result.current.dialogOpen).toBe(false);

    act(() => {
      result.current.openDialog();
      result.current.setSearchValue('poster');
    });
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.searchValue).toBe('poster');

    act(() => {
      result.current.handleManualAdd();
    });
    expect(append).toHaveBeenCalledWith({
      captionText: '',
      copyright: '',
      contentType: '',
      sourceUrl: { url: '', description: '' },
      height: '',
      width: '',
    });
    expect(result.current.uploadMessageKey).toBeNull();

    act(() => {
      result.current.handleSelectAsset(createAsset());
    });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        captionText: 'Sommerfest',
        sourceUrl: {
          url: 'https://cdn.example.com/flyer.png',
          description: 'flyer.png',
        },
      })
    );
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.searchValue).toBe('');

    act(() => {
      result.current.handleRemove(2);
    });
    expect(remove).toHaveBeenCalledWith(2);
  });

  it('surfaces unavailable assets and upload failures through stable status keys', async () => {
    const append = vi.fn();
    const { result } = renderHook(() =>
      useEventsDetailMediaState({
        append,
        onUploadFile: vi.fn().mockRejectedValueOnce(new Error('boom')),
        remove: vi.fn(),
      })
    );

    act(() => {
      result.current.handleSelectAsset(createAsset({ visibility: 'private' }));
    });
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadUnavailableUrl');

    act(() => {
      result.current.openDialog();
    });
    expect(result.current.uploadPhase).toBe('idle');
    expect(result.current.uploadMessageKey).toBeNull();

    const unsupportedEvent = {
      target: {
        files: [new File(['x'], 'flyer.pdf', { type: 'application/pdf' })],
        value: 'chosen',
      },
    } as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleUploadChange(unsupportedEvent);
    });
    expect(unsupportedEvent.target.value).toBe('');
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadUnsupportedType');

    const uploadEvent = {
      target: {
        files: [new File(['x'], 'flyer.png', { type: 'image/png' })],
        value: 'chosen',
      },
    } as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleUploadChange(uploadEvent);
    });
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadError');
  });
});

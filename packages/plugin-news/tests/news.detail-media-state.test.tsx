import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNewsDetailMediaState } from '../src/news.detail-media-state.js';

const createAsset = (overrides = {}) => ({
  id: 'asset-1',
  fileName: 'teaser.jpg',
  mimeType: 'image/jpeg',
  previewUrl: 'https://cdn.example.com/teaser.jpg',
  visibility: 'public',
  metadata: { title: 'Titelbild' },
  ...overrides,
});

describe('useNewsDetailMediaState', () => {
  it('opens the dialog, appends manual content, and closes after selecting an asset', () => {
    const append = vi.fn();
    const remove = vi.fn();

    const { result } = renderHook(() =>
      useNewsDetailMediaState({
        append,
        onUploadFile: vi.fn(),
        remove,
      })
    );

    act(() => {
      result.current.openDialog();
      result.current.setSearchValue('poster');
      result.current.handleManualAdd();
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.searchValue).toBe('poster');
    expect(append).toHaveBeenCalledWith({
      captionText: '',
      copyright: '',
      contentType: 'image',
      height: '',
      width: '',
      sourceUrl: { url: '', description: '' },
    });

    act(() => {
      result.current.handleSelectAsset(createAsset());
    });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        captionText: 'Titelbild',
        contentType: 'image',
        sourceUrl: {
          url: 'https://cdn.example.com/teaser.jpg',
          description: 'teaser.jpg',
        },
      })
    );
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.searchValue).toBe('');

    act(() => {
      result.current.handleRemove(1);
    });
    expect(remove).toHaveBeenCalledWith(1);
  });

  it('reports unavailable assets, unsupported uploads, upload errors, and successful uploads', async () => {
    const append = vi.fn();
    const onUploadFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(createAsset());

    const { result } = renderHook(() =>
      useNewsDetailMediaState({
        append,
        onUploadFile,
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
        files: [new File(['x'], 'teaser.pdf', { type: 'application/pdf' })],
        value: 'chosen',
      },
    } as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleUploadChange(unsupportedEvent);
    });
    expect(unsupportedEvent.target.value).toBe('');
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadUnsupportedType');

    const failingUploadEvent = {
      target: {
        files: [new File(['x'], 'teaser.jpg', { type: 'image/jpeg' })],
        value: 'chosen',
      },
    } as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleUploadChange(failingUploadEvent);
    });
    expect(result.current.uploadPhase).toBe('error');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadError');

    const successfulUploadEvent = {
      target: {
        files: [new File(['x'], 'teaser.jpg', { type: 'image/jpeg' })],
        value: 'chosen',
      },
    } as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleUploadChange(successfulUploadEvent);
    });
    expect(result.current.uploadPhase).toBe('success');
    expect(result.current.uploadMessageKey).toBe('messages.mediaUploadSuccess');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        captionText: 'Titelbild',
        sourceUrl: {
          url: 'https://cdn.example.com/teaser.jpg',
          description: 'teaser.jpg',
        },
      })
    );
  });
});

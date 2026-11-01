import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentMediaReferenceSyncResult } from '@sva/plugin-sdk/content-media';

import {
  StudioMediaReferenceRetryAction,
  useStudioMediaReferenceSync,
} from './studio-media-reference-sync.js';
import type { ContentMediaUsage } from './content-media-usage.js';

const usage = (): ContentMediaUsage => ({
  uiId: 'usage-1',
  assetId: 'asset-1',
  persistentUrl: 'https://cdn.example.test/image.jpg',
  altText: '',
  caption: '',
  credit: '',
  role: 'gallery_item',
  sortOrder: 0,
  referenceStatus: 'pending',
});

const Harness = ({
  result,
  onSuccess = vi.fn(),
  onFailure = vi.fn(),
}: Readonly<{
  result: ContentMediaReferenceSyncResult<{ id: string }>;
  onSuccess?: () => void;
  onFailure?: () => void;
}>) => {
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([usage()]);
  const controller = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
  return (
    <>
      <button type="button" onClick={() => controller.consumeSaveResult(result)}>
        Ergebnis übernehmen
      </button>
      <output>{mediaUsages[0]?.referenceStatus}</output>
      <StudioMediaReferenceRetryAction
        controller={controller}
        label="Referenzen erneut speichern"
        onSuccess={onSuccess}
        onFailure={onFailure}
      />
    </>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const localUsage = (draftId: string) => ({
  ...usage(),
  uiId: `usage-${draftId}`,
  assetId: undefined,
  persistentUrl: '',
  previewUrl: `blob:${draftId}`,
  localDraft: { id: draftId, file: new File(['image'], `${draftId}.png`, { type: 'image/png' }) },
} satisfies ContentMediaUsage);

describe('useStudioMediaReferenceSync', () => {
  it('retries only reference sync and marks affected usages as synced', async () => {
    const contentMutation = vi.fn();
    const retryReferenceSync = vi.fn(async () => undefined);
    const onSuccess = vi.fn();
    render(
      <Harness
        result={{
          status: 'reference_failed',
          saved: { id: 'content-1' },
          retryReferenceSync,
        }}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis übernehmen' }));
    expect(screen.getByText('failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Referenzen erneut speichern' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(retryReferenceSync).toHaveBeenCalledOnce();
    expect(contentMutation).not.toHaveBeenCalled();
    expect(screen.getByText('synced')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Referenzen erneut speichern' })).toBeNull();
  });

  it('preserves later media edits when an old save or reference retry completes', async () => {
    const retry = vi.fn(async () => undefined);
    const { result } = renderHook(() => {
      const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([usage()]);
      return {
        mediaUsages,
        setMediaUsages,
        sync: useStudioMediaReferenceSync({ mediaUsages, setMediaUsages }),
      };
    });
    const submitted = result.current.sync;
    act(() =>
      result.current.setMediaUsages((current) => [
        { ...current[0]!, caption: 'Changed during save' },
        { ...usage(), uiId: 'usage-2', assetId: 'asset-2' },
      ])
    );
    act(() =>
      submitted.consumeSaveResult({
        status: 'reference_failed',
        saved: { id: 'news-1' },
        retryReferenceSync: retry,
      })
    );
    expect(result.current.mediaUsages).toEqual([
      expect.objectContaining({ caption: 'Changed during save', referenceStatus: 'failed' }),
      expect.objectContaining({ uiId: 'usage-2', referenceStatus: 'pending' }),
    ]);
    act(() =>
      result.current.setMediaUsages((current) => [
        {
          ...current[0]!,
          assetId: 'replacement',
          persistentUrl: 'https://cdn.example.test/new.jpg',
          referenceStatus: 'pending',
        },
        ...current.slice(1),
      ])
    );
    await act(() => result.current.sync.retryReferenceSync());
    expect(result.current.mediaUsages[0]?.referenceStatus).toBe('pending');
    expect(result.current.mediaUsages[0]?.assetId).toBe('replacement');
    expect(result.current.mediaUsages[1]?.referenceStatus).toBe('pending');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps a failed retry visible and leaves usages failed', async () => {
    const retryReferenceSync = vi.fn(async () => Promise.reject(new Error('still failing')));
    const onFailure = vi.fn();
    render(
      <Harness
        result={{
          status: 'reference_failed',
          saved: { id: 'content-1' },
          retryReferenceSync,
        }}
        onFailure={onFailure}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ergebnis übernehmen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Referenzen erneut speichern' }));

    await waitFor(() => expect(onFailure).toHaveBeenCalledOnce());
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Referenzen erneut speichern' })).toBeTruthy();
  });

  it('resolves completed local uploads and releases only their previews', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const submittedDraft = localUsage('completed-upload');
    const unresolvedDraft = localUsage('not-uploaded');
    const manual = { ...usage(), uiId: 'manual', assetId: undefined, persistentUrl: '' };
    const { result } = renderHook(() => {
      const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([
        submittedDraft,
        unresolvedDraft,
        manual,
      ]);
      return { mediaUsages, sync: useStudioMediaReferenceSync({ mediaUsages, setMediaUsages }) };
    });

    act(() => {
      expect(
        result.current.sync.consumeSaveResult({
          status: 'complete',
          saved: { id: 'content-1' },
          resolutions: [
            {
              draftId: 'completed-upload',
              assetId: 'uploaded-asset',
              persistentUrl: 'https://cdn.example.test/uploaded.png',
              role: 'gallery_item',
            },
          ],
        })
      ).toEqual({ saved: { id: 'content-1' }, referenceFailed: false });
    });

    expect(result.current.mediaUsages[0]).toEqual(
      expect.objectContaining({
        assetId: 'uploaded-asset',
        persistentUrl: 'https://cdn.example.test/uploaded.png',
        referenceStatus: 'synced',
      })
    );
    expect(result.current.mediaUsages[0]).not.toHaveProperty('localDraft');
    expect(result.current.mediaUsages[0]).not.toHaveProperty('previewUrl');
    expect(result.current.mediaUsages[1]).toBe(unresolvedDraft);
    expect(result.current.mediaUsages[2]).toBe(manual);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:completed-upload');
    expect(result.current.sync.hasPendingRetry).toBe(false);
    await act(() => result.current.sync.retryReferenceSync());
    expect(result.current.mediaUsages[0]?.referenceStatus).toBe('synced');
  });

  it('preserves replacement drafts and keeps reordered resolved uploads pending', () => {
    const initial = [localUsage('replaced-upload'), localUsage('reordered-upload')] as const;
    const replacement = { ...localUsage('new-upload'), uiId: initial[0].uiId };
    const { result } = renderHook(() => {
      const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>(initial);
      return {
        mediaUsages,
        setMediaUsages,
        sync: useStudioMediaReferenceSync({ mediaUsages, setMediaUsages }),
      };
    });
    const submitted = result.current.sync;
    act(() =>
      result.current.setMediaUsages([replacement, { ...initial[1], role: 'cover', sortOrder: 1 }])
    );
    act(() =>
      submitted.consumeSaveResult({
        status: 'complete',
        saved: { id: 'content-1' },
        resolutions: initial.map((entry) => ({
          draftId: entry.localDraft.id,
          assetId: `asset-${entry.localDraft.id}`,
          persistentUrl: `https://cdn.example.test/${entry.localDraft.id}.png`,
          role: entry.role,
        })),
      })
    );

    expect(result.current.mediaUsages[0]).toBe(replacement);
    expect(result.current.mediaUsages[1]).toEqual(
      expect.objectContaining({
        assetId: 'asset-reordered-upload',
        role: 'cover',
        sortOrder: 1,
        referenceStatus: 'pending',
      })
    );
    expect(result.current.mediaUsages[1]).not.toHaveProperty('localDraft');
  });
});

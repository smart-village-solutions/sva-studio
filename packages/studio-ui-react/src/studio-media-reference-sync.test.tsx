import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

afterEach(cleanup);

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
});

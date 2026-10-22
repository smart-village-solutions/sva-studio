import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudioMediaPickerOverlay } from '@sva/studio-ui-react';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';
import { MediaDetailImageControlsSection } from './-media-detail-image-controls-section';

const upload = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  uploadHostMediaFile: upload,
}));
// This consumer test starts at the shared editor's validated local export boundary.
vi.mock('@sva/studio-ui-react', async (original) => ({
  ...(await original<typeof import('@sva/studio-ui-react')>()),
  StudioMediaPickerOverlay: (props: React.ComponentProps<typeof StudioMediaPickerOverlay>) =>
    props.open ? (
      <div>
        <button
          onClick={() =>
            props.onApplyImageEdit?.({
              file: new File(['png'], 'copy.png', { type: 'image/png' }),
              editing: {
                sourceAssetId: 'source-1',
                document: {
                  version: 1,
                  editor: 'filerobot',
                  editorVersion: '5.0.0-beta.159',
                  state: { annotations: {} },
                },
              },
            })
          }
        >
          Export übernehmen
        </button>
        <button
          disabled={props.isSavingReviewAsset}
          onClick={() => void props.onConfirmSelection()}
        >
          Kopie speichern
        </button>
        <output data-testid="transfer-state">
          {props.isUploadTransferred ? 'fixed' : 'editable'}
        </output>
      </div>
    ) : null,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('resumes transferred bytes and fixes the copy inputs until completion without writing the source', async () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:review-copy');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const asset: IamRegisteredMediaAsset = {
    id: 'source-1',
    instanceId: 'tenant-1',
    storageKey: 'tenant-1/original.png',
    mediaType: 'image',
    mimeType: 'image/png',
    byteSize: 123,
    visibility: 'protected',
    uploadStatus: 'processed',
    processingStatus: 'ready',
    metadata: { title: 'Original', tags: ['Stadt'] },
    technical: {},
  };
  const original = structuredClone(asset);
  upload
    .mockReset()
    .mockImplementationOnce(async (input) => {
      input.onTransferred({ assetId: 'copy-1', uploadSessionId: 'session-1' });
      throw new Error('processing status unavailable');
    })
    .mockResolvedValueOnce({ assetId: 'copy-1', uploadSessionId: 'session-1' });
  navigate.mockReset().mockResolvedValue(undefined);
  render(
    <MediaDetailImageControlsSection
      asset={asset}
      canCreateCopy
      metadataDraft={{ altText: 'Neuer Alttext' }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Bild bearbeiten' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export übernehmen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kopie speichern' }));
  await waitFor(() => expect(screen.getByTestId('transfer-state').textContent).toBe('fixed'));
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Kopie speichern' }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Kopie speichern' }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: '/admin/media/$mediaId',
      params: { mediaId: 'copy-1' },
    })
  );
  expect(upload).toHaveBeenCalledTimes(2);
  expect(upload.mock.calls[1][0]).toMatchObject({
    transferred: { assetId: 'copy-1', uploadSessionId: 'session-1' },
    visibility: 'protected',
    instanceId: 'tenant-1',
    metadata: { altText: 'Neuer Alttext', tags: ['Stadt'] },
    editing: { sourceAssetId: 'source-1' },
  });
  expect(asset).toEqual(original);
  expect(revoke).toHaveBeenCalledWith('blob:review-copy');
  create.mockRestore();
  revoke.mockRestore();
});

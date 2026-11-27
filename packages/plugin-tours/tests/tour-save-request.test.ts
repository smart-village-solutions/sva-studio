import type { ContentMediaUsage } from '@sva/studio-ui-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeTourAudio } from '../src/tour-audio-data.js';
import { tourAudioTarget } from '../src/tour-edit-data.js';
import {
  executeTourSave,
  tourMediaDrafts,
  type TourRequestOptions,
  type TourSaveAttempt,
} from '../src/tour-save-request.js';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  save: vi.fn(),
  markSaved: vi.fn(),
  commit: vi.fn(),
}));
vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  requestMainserverJson: mocks.request,
  saveContentWithHostMediaReferences: mocks.save,
  markHostMediaContentSaveOperationContentSaved: mocks.markSaved,
  commitHostMediaContentSaveOperation: mocks.commit,
}));

const linkedUsage: ContentMediaUsage = {
  uiId: 'linked-usage',
  assetId: 'selected-asset',
  persistentUrl: 'https://media.example.test/selected.mp3',
  altText: '',
  caption: 'Audio an der Tour',
  credit: 'Redaktion',
  role: 'audio',
  sortOrder: 0,
  referenceStatus: 'pending',
};
const draftUsage: ContentMediaUsage = {
  ...linkedUsage,
  uiId: 'draft-usage',
  assetId: undefined,
  persistentUrl: '',
  caption: 'Audio an Station 2',
  sortOrder: 1,
  localDraft: {
    id: 'draft-1',
    file: new File(['mp3-data'], 'station.mp3', { type: 'audio/mpeg' }),
  },
};
const operationId = 'fcecca5d-772d-4f33-b12e-9e168e1ed53a';
const resolvedUrl = 'https://media.example.test/station.mp3';
const response = { id: 'tour-1' };
const form = new FormData();

const request: TourRequestOptions = {
  url: '/api/v1/mainserver/tours/tour-1',
  method: 'PATCH',
  contextBinding: 'organization-context',
  media: { usages: [linkedUsage, draftUsage], syncReferences: true, instanceId: 'instance-1' },
  buildBody: (_form, resolutions) => {
    const audio = serializeTourAudio(
      { [tourAudioTarget]: [linkedUsage], 'stop-2': [draftUsage] },
      [tourAudioTarget, 'stop-2'],
      resolutions
    );
    return {
      expectedRevision: 'revision-1',
      patch: {
        mediaContents: audio[tourAudioTarget],
        tourStops: [{ id: 'stop-1' }, { id: 'stop-2', mediaContents: audio['stop-2'] }],
      },
    };
  },
};

const createAttempt = (): TourSaveAttempt => ({
  fingerprint: 'body',
  key: 'stable-save-id',
  principal: 'organization',
});

describe('tour audio content save', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.request.mockResolvedValue({ data: response });
  });

  it('prepares a library reference and a station draft in one operation before the tour write', async () => {
    mocks.save.mockImplementation(async ({ saveContent }) => ({
      status: 'complete',
      saved: await saveContent(
        [{ draftId: 'draft-1', assetId: 'draft-asset', persistentUrl: resolvedUrl }],
        { operationId }
      ),
    }));
    const result = await executeTourSave(
      request,
      createAttempt(),
      form,
      '{}',
      tourMediaDrafts(request.media)
    );
    expect(result.saved).toEqual(response);
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'tours.tour',
        requirePreparedReferences: true,
        references: [{ assetId: 'selected-asset', role: 'audio', sortOrder: 0 }],
        drafts: [expect.objectContaining({ draftId: 'draft-1', role: 'audio', sortOrder: 1 })],
      })
    );
    expect(mocks.request).toHaveBeenCalledTimes(1);
    const outgoing = mocks.request.mock.calls[0]?.[0].init;
    expect(outgoing.headers.get('X-SVA-Content-Media-Save-Operation-Id')).toBe(operationId);
    expect(outgoing.headers.get('X-SVA-Context-Binding')).toBe('organization-context');
    expect(outgoing.headers.get('Idempotency-Key')).toBe('stable-save-id');
    expect(JSON.parse(outgoing.body)).toMatchObject({
      patch: {
        mediaContents: [{ sourceUrl: { url: linkedUsage.persistentUrl } }],
        tourStops: [
          { id: 'stop-1' },
          { id: 'stop-2', mediaContents: [{ sourceUrl: { url: resolvedUrl } }] },
        ],
      },
    });
  });

  it('replays an unresolved save with the original payload and operation', async () => {
    const attempt = {
      ...createAttempt(),
      mediaOperationId: operationId,
      body: '{"original":true}',
    };
    const result = await executeTourSave(
      request,
      attempt,
      form,
      '{"replacement":true}',
      tourMediaDrafts(request.media)
    );

    expect(result.status).toBe('complete');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0]?.[0].init.body).toBe(attempt.body);
    expect(mocks.markSaved).toHaveBeenCalledWith(
      expect.objectContaining({ operationId, targetId: response.id })
    );
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ operationId }));
  });

  it('prepares a library audio reference even when there is no draft to upload', async () => {
    const libraryOnly = {
      ...request,
      media: { usages: [linkedUsage], syncReferences: false, instanceId: 'instance-1' },
    };
    mocks.save.mockImplementation(async ({ saveContent }) => ({
      status: 'complete',
      saved: await saveContent([], { operationId }),
    }));
    await executeTourSave(libraryOnly, createAttempt(), form, '{"library":true}', []);

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requirePreparedReferences: true,
        references: [{ assetId: 'selected-asset', role: 'audio', sortOrder: 0 }],
        drafts: [],
      })
    );
    expect(
      mocks.request.mock.calls[0]?.[0].init.headers.get('X-SVA-Content-Media-Save-Operation-Id')
    ).toBe(operationId);
  });
});

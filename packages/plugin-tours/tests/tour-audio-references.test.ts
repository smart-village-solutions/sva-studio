import { describe, expect, it } from 'vitest';
import { initialAudio } from '../src/tour-audio-data.js';
import { buildAudioReferences } from '../src/tour-audio-references.js';
import { tourAudioTarget, type EditableTour } from '../src/tour-edit-data.js';

const tour: EditableTour = {
  id: 'tour-1',
  revision: 'revision-1',
  name: 'Tour',
  lengthKm: 1,
  description: null,
  geometryTourData: [],
  mediaContents: ['a', 'b'].map((id) => ({
    id,
    contentType: 'audio',
    sourceUrl: { url: `https://example.test/${id}.mp3` },
  })),
  tourStops: [],
};

describe('tour audio reference lookup', () => {
  it('keeps references locked until lookup succeeds and restores positions after retry', () => {
    const loaded = [
      { assetId: 'asset-a', role: 'audio', sortOrder: 0 },
      { assetId: 'asset-b', role: 'audio', sortOrder: 1 },
    ];
    const usageB = initialAudio(tour)[tourAudioTarget]?.[1];
    if (!usageB) throw new Error('Missing test usage');

    expect(buildAudioReferences(tour, true).status).toBe('loading');
    expect(buildAudioReferences(tour, true, null).status).toBe('error');
    const result = buildAudioReferences(tour, true, loaded);
    expect(result.status).toBe('ready');
    const remaining = result.withReference(usageB);
    expect(remaining.assetId).toBe('asset-b');
    expect(result.syncNeeded([remaining])).toBe(true);
  });

  it('needs no lookup to edit a tour without own audio', () => {
    const noAudioTour = { ...tour, mediaContents: [] };
    expect(buildAudioReferences(noAudioTour, false).status).toBe('ready');
  });

  it('cannot confirm references without media permission when the tour has own audio', () => {
    expect(buildAudioReferences(tour, false).status).toBe('unavailable');
  });
});

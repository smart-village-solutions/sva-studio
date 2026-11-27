import { describe, expect, it } from 'vitest';

import {
  buildTourDraft,
  buildTourEdit,
  editableStops,
  tourAudioTarget,
  type EditableTour,
  type TourAudio,
} from '../src/tour-edit-data.js';

const clipInput = {
  contentType: 'audio',
  captionText: 'Rundgang',
  copyright: 'Stadtarchiv',
  sourceUrl: { url: 'https://example.test/rundgang.mp3' },
} as const;
const clip: TourAudio = { ...clipInput, id: 'media-42' };
const tour: EditableTour = {
  id: 'tour-1',
  name: 'Rundgang',
  lengthKm: 3,
  description: '',
  revision: 'revision-1',
  geometryTourData: [],
  mediaContents: [clip],
  tourStops: [
    { id: 'stop-1', name: 'Station 1', description: '', geoLocation: null },
    {
      id: 'stop-2',
      name: 'Station 2',
      description: '',
      geoLocation: { latitude: 49, longitude: 11 },
      mediaContents: [clip],
      inheritedPoiMediaContents: [
        { ...clip, id: 'poi-media', sourceUrl: { url: 'https://example.test/poi.mp3' } },
      ],
    },
    { id: 'stop-3', name: 'Station 3', description: '', geoLocation: null },
  ],
};

const tourForm = () => {
  const form = new FormData();
  form.set('name', tour.name ?? '');
  form.set('length', String(tour.lengthKm));
  return form;
};

describe('tour audio writes', () => {
  it('uses ID-less media input, preserves station order and omits other station fields', () => {
    const changed = { ...clip, sourceUrl: { url: 'https://example.test/new.mp3' } };
    expect(
      buildTourEdit(tourForm(), editableStops(tour), tour, {
        [tourAudioTarget]: [clip],
        'stop-2': [changed],
      })
    ).toEqual({
      expectedRevision: 'revision-1',
      patch: {
        tourStops: [
          { id: 'stop-1' },
          { id: 'stop-2', mediaContents: [{ ...clipInput, sourceUrl: changed.sourceUrl }] },
          { id: 'stop-3' },
        ],
      },
    });
  });

  it('omits unchanged audio and distinguishes explicitly clearing a station', () => {
    expect(buildTourEdit(tourForm(), editableStops(tour), tour).patch).toEqual({});
    expect(
      buildTourEdit(tourForm(), editableStops(tour), tour, {
        'stop-2': [],
      }).patch
    ).toEqual({
      tourStops: [{ id: 'stop-1' }, { id: 'stop-2', mediaContents: [] }, { id: 'stop-3' }],
    });
  });

  it('merges one existing image with new tour and station audio on draft creation', () => {
    const form = tourForm();
    form.set('media', 'https://example.test/rundgang.jpg');
    form.set('caption', 'Cover');
    const stop = {
      key: 'new-stop',
      name: 'Station 1',
      description: '',
      latitude: '',
      longitude: '',
    };
    const draft = buildTourDraft(form, [stop], {
      [tourAudioTarget]: [clip],
      [stop.key]: [clip],
    });

    expect(draft.visible).toBe(false);
    expect(draft.mediaContents).toEqual([
      {
        contentType: 'image',
        sourceUrl: { url: 'https://example.test/rundgang.jpg' },
        captionText: 'Cover',
        copyright: undefined,
      },
      clipInput,
    ]);
    expect(draft.tourStops).toEqual([
      { name: 'Station 1', description: undefined, mediaContents: [clipInput] },
    ]);
  });
});

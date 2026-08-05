import { describe, expect, it } from 'vitest';

import {
  eventEditorFieldMatrix,
  genericItemEditorFieldMatrix,
  mergeEventUpdateWithCurrent,
  mergePoiUpdateWithCurrent,
  newsEditorFieldMatrix,
  poiEditorFieldMatrix,
} from './editor-field-matrices.js';

describe('Mainserver editor field matrices', () => {
  it('classifies hard, controlled, passthrough and readonly fields explicitly', () => {
    expect(eventEditorFieldMatrix).toMatchObject({
      id: 'hard',
      title: 'controlled',
      externalId: 'passthrough',
      updatedAt: 'readonly',
    });
    expect(poiEditorFieldMatrix).toMatchObject({
      id: 'hard',
      name: 'controlled',
      payload: 'passthrough',
      createdAt: 'readonly',
    });
    expect(newsEditorFieldMatrix).toMatchObject({
      id: 'hard',
      contentBlocks: 'controlled',
      payload: 'readonly',
    });
    expect(genericItemEditorFieldMatrix).toMatchObject({
      id: 'hard',
      genericType: 'hard',
      payload: 'passthrough',
    });
  });

  it('preserves only omitted event passthrough fields from the immediate read', () => {
    const merged = mergeEventUpdateWithCurrent(
      {
        id: 'event-1',
        title: 'Alt',
        contentType: 'events.event-record',
        status: 'published',
        externalId: 'external-1',
        keywords: 'alt',
        tags: ['bestand'],
        dates: [],
        recurringWeekdays: [],
        categories: [],
        addresses: [],
        contacts: [],
        urls: [],
        mediaContents: [],
        priceInformations: [],
        visible: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
      { title: 'Neu', keywords: '' }
    );

    expect(merged).toMatchObject({
      title: 'Neu',
      externalId: 'external-1',
      keywords: '',
      tags: ['bestand'],
    });
  });

  it('preserves omitted POI payload keys and accepts explicit clears', () => {
    const merged = mergePoiUpdateWithCurrent(
      {
        id: 'poi-1',
        name: 'Alt',
        contentType: 'poi.point-of-interest',
        status: 'published',
        payload: { hidden: true },
        externalId: 'external-1',
        tags: ['bestand'],
        active: true,
        categories: [],
        addresses: [],
        priceInformations: [],
        openingHours: [],
        webUrls: [],
        mediaContents: [],
        certificates: [],
        visible: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
      { name: 'Neu', externalId: '' }
    );

    expect(merged).toMatchObject({
      name: 'Neu',
      externalId: '',
      payload: { hidden: true },
      tags: ['bestand'],
    });
  });
});

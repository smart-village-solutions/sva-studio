import { describe, expect, it } from 'vitest';

import { mapPoiItemToDetailFormValues } from '../src/poi.detail-form.js';
import type { PoiContentItem } from '../src/poi.types.js';

describe('poi.detail-form', () => {
  it('maps a poi item into the fixed tab form model', () => {
    expect(
      mapPoiItemToDetailFormValues({
        id: 'poi-1',
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        name: 'Rathaus',
        description: 'Zentrale',
        mobileDescription: 'Kurz',
        active: true,
        categoryName: 'Verwaltung',
        addresses: [{ street: 'Rathausplatz 1', city: 'Essen' }],
        openingHours: [{ weekday: 'Mo', timeFrom: '08:00', open: true }],
        webUrls: [{ url: 'https://example.test' }],
        payload: { floor: '1' },
      } satisfies PoiContentItem)
    ).toMatchObject({
      name: 'Rathaus',
      content: {
        description: 'Zentrale',
        mobileDescription: 'Kurz',
      },
    });
  });
});

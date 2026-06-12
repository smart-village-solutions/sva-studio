import { describe, expect, it } from 'vitest';

import { mapEventItemToDetailFormValues } from '../src/events.detail-form.js';
import type { EventContentItem } from '../src/events.types.js';

describe('events.detail-form', () => {
  it('maps an event item into the fixed tab form model', () => {
    expect(
      mapEventItemToDetailFormValues({
        id: 'event-1',
        contentType: 'events.event-record',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        title: 'Stadtfest',
        description: 'Innenstadt',
        categoryName: 'Kultur',
        dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
        addresses: [{ street: 'Marktplatz 1', city: 'Bochum' }],
        pointOfInterestId: 'poi-1',
      } satisfies EventContentItem)
    ).toMatchObject({
      title: 'Stadtfest',
      basis: {
        categoryName: 'Kultur',
      },
      content: {
        description: 'Innenstadt',
        pointOfInterestId: 'poi-1',
      },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { listCockpitCardItems } from './cockpit-cards-listing.js';
import type { listSvaMainserverGenericItems } from './service.js';

describe('cockpit cards listing', () => {
  it('collects all pages, filters, sorts, and paginates locally', async () => {
    const list = vi
      .fn<typeof listSvaMainserverGenericItems>()
      .mockResolvedValueOnce({
        data: [
          { id: 'other', genericType: 'FAQ', title: 'Andere' },
          {
            id: 'card-2',
            genericType: 'COCKPIT_CARD',
            title: 'Zweite',
            payload: { languageCode: 'de', sortWeight: 2 },
          },
        ] as never,
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'card-1',
            genericType: 'COCKPIT_CARD',
            title: 'Erste',
            payload: { languageCode: 'de', sortWeight: 1 },
          },
        ] as never,
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });
    const result = await listCockpitCardItems(
      { instanceId: 'instance', keycloakSubject: 'subject', page: 1, pageSize: 1 },
      list
    );
    expect(result.data.map((item) => item.id)).toEqual(['card-1']);
    expect(result.pagination).toEqual({ page: 1, pageSize: 1, hasNextPage: true, total: 2 });
    expect(result.observability).toEqual({ upstreamPageCount: 2, matchingItemCount: 2 });
  });
});

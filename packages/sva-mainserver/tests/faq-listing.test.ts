import { describe, expect, it, vi } from 'vitest';

import { compareFaqItems, listFaqItems } from '../src/server/faq-listing.js';

describe('faq listing', () => {
  it('sorts by language, sort weight, title, and id with robust payload defaults', () => {
    const items = [
      { id: 'b', title: 'Ähre 10', genericType: 'FAQ', payload: { languageCode: 'de', sortWeight: 1 } },
      { id: 'a', title: 'Ähre 2', genericType: 'FAQ', payload: { languageCode: 'de', sortWeight: 1 } },
      { id: 'c', title: 'English', genericType: 'FAQ', payload: { languageCode: 'en', sortWeight: 0 } },
      { id: 'd', title: 'Fallback', genericType: 'FAQ', payload: { languageCode: 9, sortWeight: 1.5 } },
    ];

    expect(items.toSorted(compareFaqItems).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('collects faq items across upstream pages, filters non-faqs, and paginates the sorted result', async () => {
    const listItems = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: 'generic-1', title: 'Nicht FAQ', genericType: 'INFO', payload: {} },
          { id: 'faq-2', title: 'Deutsch 2', genericType: 'FAQ', payload: { languageCode: 'de', sortWeight: 2 } },
        ],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'faq-1', title: 'Deutsch 1', genericType: 'FAQ', payload: { languageCode: 'de', sortWeight: 1 } },
          { id: 'faq-3', title: 'English', genericType: 'FAQ', payload: { languageCode: 'en', sortWeight: 0 } },
        ],
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });

    const result = await listFaqItems(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        page: 2,
        pageSize: 1,
      },
      listItems
    );

    expect(result).toEqual({
      data: [{ id: 'faq-2', title: 'Deutsch 2', genericType: 'FAQ', payload: { languageCode: 'de', sortWeight: 2 } }],
      pagination: { page: 2, pageSize: 1, hasNextPage: true, total: 3 },
      observability: { upstreamPageCount: 2, matchingItemCount: 3 },
    });
    expect(listItems).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 100 })
    );
    expect(listItems).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, pageSize: 100 })
    );
  });
});

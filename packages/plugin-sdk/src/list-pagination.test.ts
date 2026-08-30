import { describe, expect, it } from 'vitest';

import { normalizeListSearch } from './list-pagination.js';

describe('normalizeListSearch', () => {
  it('uses canonical defaults for missing or invalid values', () => {
    expect(normalizeListSearch({})).toEqual({ page: 1, pageSize: 25 });
    expect(normalizeListSearch({ page: '3' as never, pageSize: 75 as never })).toEqual({
      page: 1,
      pageSize: 25,
    });
  });

  it('keeps supported page sizes and positive integer pages', () => {
    expect(normalizeListSearch({ page: 2, pageSize: 50 })).toEqual({ page: 2, pageSize: 50 });
  });

  it('caps pages at the maximum offset for each supported page size', () => {
    expect(normalizeListSearch({ page: 9999, pageSize: 25 })).toEqual({ page: 401, pageSize: 25 });
    expect(normalizeListSearch({ page: 1000, pageSize: 100 })).toEqual({
      page: 101,
      pageSize: 100,
    });
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeListSearch } from '../src/list-pagination.js';

describe('normalizeListSearch', () => {
  it('uses the first page and default page size when search parameters are absent', () => {
    expect(normalizeListSearch({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('normalizes unsupported page sizes to the default value', () => {
    expect(normalizeListSearch({ page: 3, pageSize: 13 })).toEqual({ page: 3, pageSize: 25 });
  });

  it('caps the page number to the maximum visible offset budget', () => {
    expect(normalizeListSearch({ page: 9999, pageSize: 25 })).toEqual({ page: 401, pageSize: 25 });
  });
});

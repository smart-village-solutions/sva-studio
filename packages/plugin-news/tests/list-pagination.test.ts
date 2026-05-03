import { describe, expect, it } from 'vitest';

import { normalizeListSearch } from '../src/list-pagination.js';

describe('normalizeListSearch', () => {
  it('normalizes unsupported page sizes to the default value', () => {
    expect(normalizeListSearch({ page: 3, pageSize: 13 })).toEqual({ page: 3, pageSize: 25 });
  });

  it('caps the page number to the maximum visible offset budget', () => {
    expect(normalizeListSearch({ page: 9999, pageSize: 25 })).toEqual({ page: 401, pageSize: 25 });
  });
});

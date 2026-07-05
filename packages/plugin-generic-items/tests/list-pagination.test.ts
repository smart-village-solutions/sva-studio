import { describe, expect, it } from 'vitest';

import { normalizeListSearch } from '../src/list-pagination.js';

describe('generic items list pagination', () => {
  it('uses the canonical paging defaults and clamps oversized offsets', () => {
    expect(normalizeListSearch({})).toEqual({ page: 1, pageSize: 25 });
    expect(normalizeListSearch({ page: 2, pageSize: 50 })).toEqual({ page: 2, pageSize: 50 });
    expect(normalizeListSearch({ page: '3' as never, pageSize: 75 as never })).toEqual({ page: 1, pageSize: 25 });
    expect(normalizeListSearch({ page: 1_000, pageSize: 100 })).toEqual({ page: 101, pageSize: 100 });
  });
});

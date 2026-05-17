import { describe, expect, it } from 'vitest';

import { wasteManagementAllPageSize } from '../src/search-params.js';
import { createPagedItems } from '../src/waste-management.table-frame.js';

describe('createPagedItems', () => {
  it('collapses the all-page-size sentinel into a single full page', () => {
    expect(
      createPagedItems({
        items: ['a', 'b', 'c'],
        page: 3,
        pageSize: wasteManagementAllPageSize,
      })
    ).toEqual({
      items: ['a', 'b', 'c'],
      pageCount: 1,
      safePage: 1,
      totalItems: 3,
    });
  });
});

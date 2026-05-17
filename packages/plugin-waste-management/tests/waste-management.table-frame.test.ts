import { describe, expect, it } from 'vitest';

import { createPagedItems } from '../src/waste-management.table-frame.js';

describe('createPagedItems', () => {
  it('caps the active page to the available page count', () => {
    expect(
      createPagedItems({
        items: ['a', 'b', 'c'],
        page: 3,
        pageSize: 2,
      })
    ).toEqual({
      items: ['c'],
      pageCount: 2,
      safePage: 2,
      totalItems: 3,
    });
  });
});

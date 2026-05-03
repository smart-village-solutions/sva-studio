import { describe, expect, it } from 'vitest';

import { parseMainserverListQuery } from './mainserver-list-pagination.js';

describe('parseMainserverListQuery', () => {
  it('normalizes unsupported page sizes to the default value', () => {
    const query = parseMainserverListQuery(new Request('https://studio.test/api/v1/mainserver/news?page=3&pageSize=13'));

    expect(query).toEqual({ page: 3, pageSize: 25 });
  });

  it('caps page to the maximum visible offset budget', () => {
    const query = parseMainserverListQuery(new Request('https://studio.test/api/v1/mainserver/news?page=9999&pageSize=25'));

    expect(query).toEqual({ page: 401, pageSize: 25 });
  });
});

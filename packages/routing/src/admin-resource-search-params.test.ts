import { describe, expect, it } from 'vitest';

import { normalizeAdminResourceListSearch } from './admin-resource-search-params.js';
import type { AdminResourceDefinition } from '@sva/plugin-sdk';

const resource = {
  resourceId: 'news.reports',
  basePath: 'reports',
  titleKey: 'news.reports.title',
  guard: 'content',
  views: {
    list: { bindingKey: 'news.reports.list' },
    create: { bindingKey: 'news.reports.create' },
    detail: { bindingKey: 'news.reports.detail' },
  },
  capabilities: {
    list: {
      search: {
        param: 'q',
        placeholderKey: 'news.reports.search.placeholder',
        fields: ['title'],
      },
      filters: [
        {
          id: 'status',
          param: 'status',
          labelKey: 'news.reports.status',
          bindingKey: 'news.reports.status',
          defaultValue: 'draft',
          options: [
            { value: 'draft', labelKey: 'news.reports.draft' },
            { value: 'published', labelKey: 'news.reports.published' },
          ],
        },
      ],
      sorting: {
        param: 'sort',
        defaultField: 'updatedAt',
        defaultDirection: 'desc',
        fields: [
          { id: 'title', labelKey: 'news.reports.title', bindingKey: 'news.reports.title' },
          { id: 'updatedAt', labelKey: 'news.reports.updatedAt', bindingKey: 'news.reports.updatedAt' },
        ],
      },
      pagination: {
        pageParam: 'page',
        pageSizeParam: 'pageSize',
        defaultPageSize: 25,
        pageSizeOptions: [10, 25, 50],
      },
    },
  },
} as const satisfies AdminResourceDefinition;

describe('admin resource search parameter normalization', () => {
  it('normalizes declared list search, filters, sorting and pagination', () => {
    expect(
      normalizeAdminResourceListSearch(resource, {
        q: '  Alpha  ',
        status: 'published',
        sort: 'title',
        page: '2',
        pageSize: '50',
      })
    ).toEqual({
      search: 'Alpha',
      filters: { status: 'published' },
      sort: { field: 'title', direction: 'asc' },
      page: 2,
      pageSize: 50,
    });
  });

  it('falls back to declared defaults for unsupported values', () => {
    expect(
      normalizeAdminResourceListSearch(resource, {
        status: 'archived',
        sort: '-unknown',
        page: '0',
        pageSize: '500',
      })
    ).toEqual({
      search: undefined,
      filters: { status: 'draft' },
      sort: { field: 'updatedAt', direction: 'desc' },
      page: 1,
      pageSize: 25,
    });
  });

  it('normalizes descending sort and primitive search values', () => {
    expect(
      normalizeAdminResourceListSearch(resource, {
        q: true,
        sort: '-updatedAt',
        page: 3,
        pageSize: 10,
      })
    ).toEqual({
      search: 'true',
      filters: { status: 'draft' },
      sort: { field: 'updatedAt', direction: 'desc' },
      page: 3,
      pageSize: 10,
    });
  });

  it('uses sort defaults when the sort param is omitted', () => {
    expect(normalizeAdminResourceListSearch(resource, { q: '', status: false })).toEqual({
      search: undefined,
      filters: { status: 'draft' },
      sort: { field: 'updatedAt', direction: 'desc' },
      page: 1,
      pageSize: 25,
    });
  });

  it('omits unsupported optional capabilities instead of inventing state', () => {
    const simpleResource = {
      resourceId: 'news.simple',
      basePath: 'simple',
      titleKey: 'news.simple.title',
      guard: 'content',
      views: {
        list: { bindingKey: 'news.simple.list' },
        create: { bindingKey: 'news.simple.create' },
        detail: { bindingKey: 'news.simple.detail' },
      },
      capabilities: {
        list: {
          filters: [
            {
              id: 'category',
              labelKey: 'news.simple.category',
              bindingKey: 'news.simple.category',
              options: [{ value: 'local', labelKey: 'news.simple.local' }],
            },
          ],
        },
      },
    } as const satisfies AdminResourceDefinition;

    expect(normalizeAdminResourceListSearch(simpleResource, { category: 'external', page: '2' })).toEqual({
      search: undefined,
      filters: {},
      sort: undefined,
      page: undefined,
      pageSize: undefined,
    });
  });

  it('uses canonical default query parameter names when capabilities omit custom params', () => {
    const defaultParamResource = {
      resourceId: 'news.defaults',
      basePath: 'defaults',
      titleKey: 'news.defaults.title',
      guard: 'content',
      views: {
        list: { bindingKey: 'news.defaults.list' },
        create: { bindingKey: 'news.defaults.create' },
        detail: { bindingKey: 'news.defaults.detail' },
      },
      capabilities: {
        list: {
          search: {
            placeholderKey: 'news.defaults.search.placeholder',
            fields: ['title'],
          },
          sorting: {
            defaultField: 'title',
            defaultDirection: 'asc',
            fields: [{ id: 'title', labelKey: 'news.defaults.title', bindingKey: 'news.defaults.title' }],
          },
          pagination: {
            defaultPageSize: 20,
            pageSizeOptions: [20, 40],
          },
        },
      },
    } as const satisfies AdminResourceDefinition;

    expect(
      normalizeAdminResourceListSearch(defaultParamResource, {
        q: 'Beta',
        sort: '-title',
        page: '4',
        pageSize: '40',
      })
    ).toEqual({
      search: 'Beta',
      filters: {},
      sort: { field: 'title', direction: 'desc' },
      page: 4,
      pageSize: 40,
    });
  });

  it('keeps legacy resources without list capabilities empty', () => {
    expect(
      normalizeAdminResourceListSearch(
        {
          resourceId: 'news.legacy',
          basePath: 'legacy',
          titleKey: 'news.legacy.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'news.legacy.list' },
            create: { bindingKey: 'news.legacy.create' },
            detail: { bindingKey: 'news.legacy.detail' },
          },
        },
        { q: 'ignored' }
      )
    ).toEqual({ filters: {} });
  });
});

import { describe, expect, it } from 'vitest';

import {
  createDocumentationPageCatalog,
  resolveActiveRouteDocumentation,
} from './route-documentation.js';

describe('route documentation', () => {
  it('resolves the deepest active route documentation', () => {
    expect(
      resolveActiveRouteDocumentation([
        { staticData: { documentation: { kind: 'page', id: 'home.overview', pageType: 'overview' } } },
        { staticData: { documentation: { kind: 'page', id: 'admin.users.detail', pageType: 'detail' } } },
      ])
    ).toEqual({ kind: 'page', id: 'admin.users.detail', pageType: 'detail' });
  });

  it('rejects duplicate ids and canonical paths', () => {
    const first = {
      id: 'content.list',
      path: '/admin/content',
      pageType: 'list' as const,
      owner: { kind: 'host' as const },
    };
    expect(() => createDocumentationPageCatalog([first, { ...first, path: '/other' }])).toThrow(
      'duplicate_documentation_page_id:content.list'
    );
    expect(() =>
      createDocumentationPageCatalog([first, { ...first, id: 'content.detail' }])
    ).toThrow('duplicate_documentation_page_path:/admin/content');
  });
});

import { describe, expect, it } from 'vitest';

import {
  createStudioMainserverGenericTypeRegistry,
  studioMainserverGenericTypeRegistry,
} from './mainserver-generic-type-registry.server.js';

const catalogEntry = {
  pluginId: 'faq',
  sourceType: 'workspace' as const,
  enabled: true,
  sourceRef: 'packages/plugin-faq',
};

describe('server-safe Mainserver GenericItem registry', () => {
  it('loads the enabled workspace ownership declarations', () => {
    expect(Object.fromEntries(studioMainserverGenericTypeRegistry)).toEqual({
      COCKPIT_CARD: 'cockpit-cards.cockpit-card',
      FAQ: 'faq.faq',
      FeaturedProject: 'projects.project',
    });
  });

  it('collects ownership only from enabled catalog plugins', () => {
    const registry = createStudioMainserverGenericTypeRegistry({
      catalogConfig: [catalogEntry, { ...catalogEntry, pluginId: 'projects', enabled: false }],
      workspaceModules: {
        '../../../../packages/plugin-faq/src/generic-item-ownership.ts': {
          faqOwnership: { contentType: 'faq.faq', mainserverGenericType: 'FAQ' },
          legacyFaqOwnership: {
            contentType: 'faq.faq',
            mainserverGenericType: 'LEGACY_FAQ',
          },
        },
        '../../../../packages/plugin-projects/src/generic-item-ownership.ts': {
          projectsOwnership: {
            contentType: 'projects.project',
            mainserverGenericType: 'FeaturedProject',
          },
        },
      },
      nodeModules: {},
    });

    expect([...registry]).toEqual([
      ['FAQ', 'faq.faq'],
      ['LEGACY_FAQ', 'faq.faq'],
    ]);
  });

  it('rejects ownership for content types that are not GenericItem projections', () => {
    expect(() =>
      createStudioMainserverGenericTypeRegistry({
        catalogConfig: [{ ...catalogEntry, pluginId: 'news' }],
        workspaceModules: {
          '../../../../packages/plugin-faq/src/generic-item-ownership.ts': {
            ownership: { contentType: 'news.article', mainserverGenericType: 'ARTICLE' },
          },
        },
        nodeModules: {},
      })
    ).toThrow('unsupported_mainserver_generic_item_content_type:news.article');
  });

  it('does not depend on the browser plugin snapshot module', () => {
    const rawModules = import.meta.glob('./mainserver-generic-type-registry.server.ts', {
      eager: true,
      import: 'default',
      query: '?raw',
    }) as Record<string, string>;
    const source = rawModules['./mainserver-generic-type-registry.server.ts'];

    expect(source).not.toContain("from './plugins.js'");
    expect(source).not.toContain('createBrowserLogger');
  });
});

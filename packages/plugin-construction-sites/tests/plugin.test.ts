import { describe, expect, it } from 'vitest';
import { pluginConstructionSites } from '../src/plugin.js';
import { constructionSitesMainserverGenericItemOwnership } from '../src/generic-item-ownership.js';
import { pluginConstructionSitesTranslations } from '../src/plugin.translations.js';

describe('construction-sites plugin registration', () => {
  it('owns the exact upstream type and only contributes read/create/update permissions', () => {
    expect(constructionSitesMainserverGenericItemOwnership).toMatchObject({
      mainserverGenericType: 'ConstructionSite',
      contentType: 'construction-sites.construction-site',
    });
    expect(pluginConstructionSites.permissions?.map((item) => item.id)).toEqual([
      'construction-sites.read',
      'construction-sites.create',
      'construction-sites.update',
    ]);
    expect(pluginConstructionSites.actions?.some((item) => item.id.endsWith('.delete'))).toBe(
      false
    );
    expect(pluginConstructionSites.contentHistory).toMatchObject({ mode: 'host' });
  });
  it('provides the same complete translation keys in German and English', () => {
    const keys = (value: object): string[] =>
      Object.entries(value)
        .flatMap(([key, entry]) =>
          typeof entry === 'string' ? [key] : keys(entry).map((child) => `${key}.${child}`)
        )
        .sort();
    expect(keys(pluginConstructionSitesTranslations.de['construction-sites'])).toEqual(
      keys(pluginConstructionSitesTranslations.en['construction-sites'])
    );
  });
});

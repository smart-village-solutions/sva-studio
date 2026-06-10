import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pluginCategories } from '../src/index.js';

describe('pluginCategories contract', () => {
  it('exposes the categories plugin contract with its own permission set', () => {
    expect(pluginCategories.id).toBe('categories');
    expect(pluginCategories.displayName).toBe('Kategorien');
    expect(pluginCategories.routes).toEqual([]);
    expect(pluginCategories.permissions).toEqual([
      { id: 'categories.read', titleKey: 'categories.permissions.read' },
      { id: 'categories.create', titleKey: 'categories.permissions.create' },
      { id: 'categories.update', titleKey: 'categories.permissions.update' },
      { id: 'categories.delete', titleKey: 'categories.permissions.delete' },
    ]);
    expect(pluginCategories.moduleIam).toMatchObject({
      moduleId: 'categories',
      permissionIds: ['categories.read', 'categories.create', 'categories.update', 'categories.delete'],
    });
    expect(pluginCategories.translations).toMatchObject({
      de: {
        categories: {
          navigation: {
            title: 'Kategorien',
          },
        },
      },
      en: {
        categories: {
          navigation: {
            title: 'Categories',
          },
        },
      },
    });
  });

  it('keeps the manifest capability contract minimal for the current scaffold', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'plugin.manifest.json'), 'utf8')
    ) as {
      hostCompatibility?: {
        requiredCapabilities?: readonly string[];
      };
    };

    expect(manifest.hostCompatibility?.requiredCapabilities).toBeUndefined();
  });
});

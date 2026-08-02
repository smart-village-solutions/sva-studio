import { describe, expect, it } from 'vitest';

import {
  pluginGenericItems,
  pluginGenericItemsActionDefinitions,
  pluginGenericItemsPermissionDefinitions,
} from '../src/plugin.js';
import { genericItemsTranslationsDe } from '../src/plugin.translations.de.js';

describe('pluginGenericItems contract', () => {
  it('uses the approved German editorial terminology', () => {
    expect(pluginGenericItems.displayName).toBe('Generische Inhalte');
    expect(genericItemsTranslationsDe.genericItems.navigation.title).toBe('Generische Inhalte');
    expect(genericItemsTranslationsDe.genericItems.fields.title).toBe('Überschrift');
    expect(genericItemsTranslationsDe.genericItems.fields.teaser).toBe('Einleitung');
    expect(genericItemsTranslationsDe.genericItems.fields.intro).toBe('Einleitung');
  });

  it('keeps the canonical standard content contract', () => {
    expect(pluginGenericItems.navigation).toEqual([
      {
        id: 'generic-items.navigation',
        to: '/admin/generic-items',
        titleKey: 'genericItems.navigation.title',
        section: 'dataManagement',
        requiredAction: 'generic-items.read',
      },
    ]);
    expect(pluginGenericItems.actions?.map((action) => action.id)).toEqual([
      'generic-items.create',
      'generic-items.edit',
      'generic-items.update',
      'generic-items.delete',
    ]);
    expect(pluginGenericItems.actions).toEqual(pluginGenericItemsActionDefinitions);
    expect(pluginGenericItems.permissions).toEqual(pluginGenericItemsPermissionDefinitions);
    expect(pluginGenericItems.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'generic-items.content',
        basePath: 'generic-items',
        contentUi: {
          contentType: 'generic-items.generic-item',
          bindings: {
            list: { bindingKey: 'genericItemsList' },
            detail: { bindingKey: 'genericItemsDetail' },
            editor: { bindingKey: 'genericItemsEditor' },
          },
        },
      }),
    ]);
  });
});

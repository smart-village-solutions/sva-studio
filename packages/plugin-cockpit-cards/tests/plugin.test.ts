import { describe, expect, it } from 'vitest';

import {
  pluginCockpitCards,
  pluginCockpitCardsActionDefinitions,
  pluginCockpitCardsPermissionDefinitions,
} from '../src/plugin.js';

describe('cockpit cards plugin contract', () => {
  it('registers an independent standard content resource', () => {
    expect(pluginCockpitCards.id).toBe('cockpit-cards');
    expect(pluginCockpitCards.actions).toEqual(pluginCockpitCardsActionDefinitions);
    expect(pluginCockpitCards.permissions).toEqual(pluginCockpitCardsPermissionDefinitions);
    expect(pluginCockpitCards.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'cockpit-cards.content',
        contentUi: expect.objectContaining({
          contentType: 'cockpit-cards.cockpit-card',
          bindings: {
            list: { bindingKey: 'cockpitCardsList' },
            detail: { bindingKey: 'cockpitCardsDetail' },
            editor: { bindingKey: 'cockpitCardsEditor' },
          },
        }),
      }),
    ]);
    expect(pluginCockpitCards.permissions?.map((permission) => permission.id)).toEqual([
      'cockpit-cards.read',
      'cockpit-cards.create',
      'cockpit-cards.update',
      'cockpit-cards.delete',
    ]);
  });
});

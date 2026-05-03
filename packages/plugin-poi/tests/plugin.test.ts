import { describe, expect, it } from 'vitest';

import { pluginPoi } from '../src/plugin.js';

describe('pluginPoi contract', () => {
  it('keeps the canonical standard content contract', () => {
    expect(pluginPoi.navigation).toEqual([
      {
        id: 'poi.navigation',
        to: '/admin/poi',
        titleKey: 'poi.navigation.title',
        section: 'dataManagement',
        requiredAction: 'poi.read',
      },
    ]);
    expect(pluginPoi.actions?.map((action) => action.id)).toEqual([
      'poi.create',
      'poi.edit',
      'poi.update',
      'poi.delete',
    ]);
    expect(pluginPoi.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'poi.content',
        basePath: 'poi',
        contentUi: {
          contentType: 'poi.point-of-interest',
          bindings: {
            list: { bindingKey: 'poiList' },
            detail: { bindingKey: 'poiDetail' },
            editor: { bindingKey: 'poiEditor' },
          },
        },
      }),
    ]);
  });
});

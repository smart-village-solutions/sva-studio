import { describe, expect, it } from 'vitest';

import { pluginEvents } from '../src/plugin.js';

describe('pluginEvents contract', () => {
  it('keeps the canonical standard content contract', () => {
    expect(pluginEvents.navigation).toEqual([
      {
        id: 'events.navigation',
        to: '/admin/events',
        titleKey: 'events.navigation.title',
        section: 'dataManagement',
        requiredAction: 'events.read',
      },
    ]);
    expect(pluginEvents.actions?.map((action) => action.id)).toEqual([
      'events.create',
      'events.edit',
      'events.update',
      'events.delete',
    ]);
    expect(pluginEvents.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'events.content',
        basePath: 'events',
        contentUi: {
          contentType: 'events.event-record',
          bindings: {
            list: { bindingKey: 'eventsList' },
            detail: { bindingKey: 'eventsDetail' },
            editor: { bindingKey: 'eventsEditor' },
          },
        },
      }),
    ]);
  });
});

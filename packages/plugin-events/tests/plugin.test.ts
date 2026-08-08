import { describe, expect, it } from 'vitest';

import {
  pluginEvents,
  pluginEventsActionDefinitions,
  pluginEventsPermissionDefinitions,
} from '../src/plugin.js';
import { pluginEventsTranslations } from '../src/plugin.translations.js';

describe('pluginEvents contract', () => {
  it('uses the approved German editorial terminology', () => {
    expect(pluginEvents.displayName).toBe('Events');
    expect(pluginEventsTranslations.de.events.navigation.title).toBe('Veranstaltungen');
    expect(pluginEventsTranslations.de.events.fields.title).toBe('Überschrift');
    expect(pluginEventsTranslations.en.events.navigation.title).toBe('Events');
  });

  it('keeps the canonical standard content contract', () => {
    expect(pluginEvents.navigation).toEqual([
      {
        id: 'events.navigation',
        to: '/admin/events',
        titleKey: 'events.navigation.title',
        section: 'dataManagement',
        requiredAction: 'events.read',
        accessRequirement: {
          kind: 'tenant',
          moduleId: 'events',
          actions: { mode: 'allOf', values: ['events.read'] },
          resourceContext: 'collection',
        },
      },
    ]);
    expect(pluginEvents.actions?.map((action) => action.id)).toEqual([
      'events.create',
      'events.edit',
      'events.update',
      'events.delete',
    ]);
    expect(pluginEvents.actions).toEqual(pluginEventsActionDefinitions);
    expect(pluginEvents.permissions).toEqual(pluginEventsPermissionDefinitions);
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

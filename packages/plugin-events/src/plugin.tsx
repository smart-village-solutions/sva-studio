import {
  defineMediaPickerDefinition,
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { EVENTS_CONTENT_TYPE } from './events.constants.js';
import { pluginEventsTranslations } from './plugin.translations.js';

const standardEventsContribution = createStandardContentPluginContribution({
  pluginId: 'events',
  displayName: 'Events',
  contentType: EVENTS_CONTENT_TYPE,
  titleKey: 'events.navigation.title',
  listBindingKey: 'eventsList',
  detailBindingKey: 'eventsDetail',
  editorBindingKey: 'eventsEditor',
});

export const pluginEventsPermissionDefinitions = standardEventsContribution.permissions;

export const pluginEventsActionDefinitions = standardEventsContribution.actions;

export const pluginEventsMediaPickers = {
  headerImage: defineMediaPickerDefinition({
    roles: ['header_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'hero',
  }),
} as const;

export const pluginEvents: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'events',
  displayName: 'Events',
  contribution: standardEventsContribution,
  translations: pluginEventsTranslations,
});

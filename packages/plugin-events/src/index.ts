export * from './index.api.js';
export type * from './index.types.js';
export * from './index.ui.js';

import { pluginEvents as descriptor } from './plugin.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';
import { deleteEvent, getEventDetail, updateEvent } from './events.api.js';
const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'events.delete', execute: deleteEvent },
  status: {
    requiredAction: 'events.update',
    supportedStatuses: ['draft', 'published'],
    execute: async (contentId, status, principal) => {
      const current = await getEventDetail(contentId, principal);
      // Read-only metadata has no effect on the existing event update mapping.
      const readOnlyGroups = new Set([
        'id',
        'contentType',
        'status',
        'createdAt',
        'updatedAt',
        'dataProvider',
      ]);
      if (
        current.deviations.some(
          (deviation) =>
            deviation.fieldGroup !== 'visible' && !readOnlyGroups.has(deviation.fieldGroup)
        )
      ) {
        throw new Error('content_status_detail_degraded');
      }
      await updateEvent(contentId, { ...current.data, visible: status === 'published' }, principal);
    },
  },
};
export const pluginEvents: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};

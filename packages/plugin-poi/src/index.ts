export { POI_CONTENT_TYPE } from './poi.constants.js';
export { listPoi, getPoi, getPoiDetail, createPoi, updatePoi, deletePoi } from './poi.api.js';
export { PoiDetailPage } from './poi.detail-page.js';
export { PoiCreatePage, PoiEditPage } from './poi.pages.js';
import { pluginPoi as descriptor } from './plugin.js';
import { PoiCreatePage, PoiEditPage } from './poi.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'poiDetail', component: PoiEditPage },
  { bindingKey: 'poiEditor', component: PoiCreatePage },
] as const;
export type { PoiContentItem, PoiFormInput, PoiListQuery, PoiListResult } from './poi.types.js';

import { deletePoi, getPoiDetail, updatePoi } from './poi.api.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';

const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'poi.delete', execute: deletePoi },
  status: {
    requiredAction: 'poi.update',
    supportedStatuses: ['draft', 'published'],
    execute: async (contentId, status, principal) => {
      const current = await getPoiDetail(contentId, principal);
      // These metadata groups are not part of the existing update input/mapping.
      const readOnlyGroups = new Set([
        'id',
        'contentType',
        'status',
        'createdAt',
        'updatedAt',
        'dataProvider',
        'visible',
      ]);
      if (
        current.deviations.some(
          (deviation) =>
            deviation.fieldGroup !== 'active' && !readOnlyGroups.has(deviation.fieldGroup)
        )
      ) {
        throw new Error('content_status_detail_degraded');
      }
      await updatePoi(contentId, { ...current.data, active: status === 'published' }, principal);
    },
  },
};
export const pluginPoi: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};

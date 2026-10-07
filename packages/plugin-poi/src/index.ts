export { POI_CONTENT_TYPE } from './poi.constants.js';
export { listPoi, getPoi, getPoiDetail, createPoi, updatePoi, deletePoi } from './poi.api.js';
export { PoiDetailPage } from './poi.detail-page.js';
export { PoiCreatePage, PoiEditPage } from './poi.pages.js';
export { pluginPoi } from './plugin.js';
import { PoiCreatePage, PoiEditPage } from './poi.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'poiDetail', component: PoiEditPage },
  { bindingKey: 'poiEditor', component: PoiCreatePage },
] as const;
export type { PoiContentItem, PoiFormInput, PoiListQuery, PoiListResult } from './poi.types.js';
